/**
 * Central Claude Pro/Max OAuth broker.
 *
 * Holds the ONE shared subscription credential for the whole instance:
 *  - capture: admin runs the browser OAuth once (start → complete);
 *  - refresh: done centrally here (single-flight) so concurrent sandbox traffic
 *    never races the refresh-token rotation and invalidates the credential;
 *  - access: the router asks getValidAnthropicAccessToken() per request.
 *
 * The refresh token (full-account credential) lives ONLY here + in the DB. It is
 * never sent to a sandbox — sandboxes route Claude calls through the backend
 * router, which attaches the short-lived access token.
 *
 * NOTE: single-flight is in-process. The deploy is a single backend instance; if
 * ever scaled horizontally, move the refresh lock to the DB (SELECT ... FOR UPDATE).
 */
import { createHash, randomBytes } from 'node:crypto';
import {
  ANTHROPIC_CLIENT_ID,
  ANTHROPIC_TOKEN_URL,
  ANTHROPIC_AUTHORIZE_URL,
  ANTHROPIC_TOKEN_USER_AGENT,
  ANTHROPIC_EXPIRES_SKEW_MS,
  ANTHROPIC_OAUTH_TOKEN_LIFETIME_SECONDS,
  ANTHROPIC_MAX_SCOPE,
} from './constants';
import {
  getStoredAnthropicOAuth,
  upsertAnthropicOAuth,
  deleteAnthropicOAuth,
  type AnthropicOAuthRow,
} from './store';

// ─── PKCE ─────────────────────────────────────────────────────────────────────

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

// ─── Capture (admin, one-time) ──────────────────────────────────────────────────

// Short-lived state from start() → complete(), keyed by `state`.
const pending = new Map<string, { verifier: string; redirectURI: string; createdAt: number }>();
const PENDING_TTL_MS = 15 * 60 * 1000;

function prunePending() {
  const now = Date.now();
  for (const [state, v] of pending) if (now - v.createdAt > PENDING_TTL_MS) pending.delete(state);
}

/** Step 1: build the claude.ai authorize URL and remember the PKCE verifier. */
export function startAnthropicOAuth(): { url: string; state: string } {
  prunePending();
  const pkce = generatePKCE();
  const state = base64url(randomBytes(32));
  // "max" mode redirect: a localhost URL the user copies back (no server listens).
  const port = 40000 + Math.floor(Math.random() * 20000);
  const redirectURI = `http://localhost:${port}/callback`;
  pending.set(state, { verifier: pkce.verifier, redirectURI, createdAt: Date.now() });

  const url = new URL(ANTHROPIC_AUTHORIZE_URL);
  url.searchParams.set('code', 'true');
  url.searchParams.set('client_id', ANTHROPIC_CLIENT_ID);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectURI);
  url.searchParams.set('scope', ANTHROPIC_MAX_SCOPE);
  url.searchParams.set('code_challenge', pkce.challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', state);
  return { url: url.toString(), state };
}

function tokenHeaders(): Record<string, string> {
  return {
    Accept: 'application/json, text/plain, */*',
    'Content-Type': 'application/json',
    'User-Agent': ANTHROPIC_TOKEN_USER_AGENT,
  };
}

/** Parse the pasted redirect URL / code#state into a bare code + state. */
function parseCallbackCode(input: string, fallbackState: string): { code: string; state: string } {
  const value = input.trim();
  if (value.includes('#') && !value.startsWith('http')) {
    const [code, state] = value.split('#');
    return { code, state: state || fallbackState };
  }
  if (value.startsWith('http://') || value.startsWith('https://')) {
    const u = new URL(value);
    return {
      code: u.searchParams.get('code') || u.hash.replace(/^#/, '') || value,
      state: u.searchParams.get('state') || fallbackState,
    };
  }
  if (value.includes('code=') || value.includes('state=')) {
    const p = new URLSearchParams(value.replace(/^\?/, ''));
    return { code: p.get('code') || value, state: p.get('state') || fallbackState };
  }
  return { code: value, state: fallbackState };
}

/** Step 2: exchange the pasted code for tokens and persist the credential. */
export async function completeAnthropicOAuth(rawCode: string): Promise<{ ok: true } | { ok: false; error: string }> {
  prunePending();
  // Resolve the state from the pasted value if present, else try the only pending one.
  let entry: { verifier: string; redirectURI: string } | undefined;
  let parsed = parseCallbackCode(rawCode, '');
  if (parsed.state && pending.has(parsed.state)) {
    entry = pending.get(parsed.state)!;
  } else if (pending.size === 1) {
    const [[state, only]] = [...pending.entries()];
    entry = only;
    parsed = parseCallbackCode(rawCode, state);
  }
  if (!entry) return { ok: false, error: 'Sessão de login expirada ou não encontrada. Recomece a conexão.' };

  let response: Response;
  try {
    response = await fetch(ANTHROPIC_TOKEN_URL, {
      method: 'POST',
      headers: tokenHeaders(),
      body: JSON.stringify({
        code: parsed.code,
        state: parsed.state,
        grant_type: 'authorization_code',
        client_id: ANTHROPIC_CLIENT_ID,
        redirect_uri: entry.redirectURI,
        code_verifier: entry.verifier,
        expires_in: ANTHROPIC_OAUTH_TOKEN_LIFETIME_SECONDS,
      }),
    });
  } catch (err) {
    return { ok: false, error: `Falha na troca do código: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (!response.ok) {
    return { ok: false, error: `Anthropic recusou a troca (${response.status}). Verifique o código colado.` };
  }
  const json = (await response.json()) as { refresh_token: string; access_token: string; expires_in: number };
  const expires = Date.now() + json.expires_in * 1000 - ANTHROPIC_EXPIRES_SKEW_MS;
  await upsertAnthropicOAuth(json.access_token, json.refresh_token, expires);
  cached = { access: json.access_token, expires };
  pending.clear();
  return { ok: true };
}

// ─── Central refresh + access ───────────────────────────────────────────────────

let cached: { access: string; expires: number } | null = null;
let refreshInFlight: Promise<string | null> | null = null;

async function loadOrRefresh(): Promise<string | null> {
  let row: AnthropicOAuthRow | null;
  try {
    row = await getStoredAnthropicOAuth();
  } catch {
    return null; // table missing / DB error → treat as no credential
  }
  if (!row) {
    cached = null;
    return null;
  }
  if (row.access && row.expires > Date.now() + ANTHROPIC_EXPIRES_SKEW_MS) {
    cached = { access: row.access, expires: row.expires };
    return row.access;
  }
  // expired → refresh (rotates the refresh token; persist the new one)
  let response: Response;
  try {
    response = await fetch(ANTHROPIC_TOKEN_URL, {
      method: 'POST',
      headers: tokenHeaders(),
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: row.refresh,
        client_id: ANTHROPIC_CLIENT_ID,
        scope: ANTHROPIC_MAX_SCOPE,
      }),
    });
  } catch (err) {
    console.error('[anthropic-oauth] refresh request threw', err);
    return row.access || null; // last-ditch: hand back the old token
  }
  if (!response.ok) {
    console.error('[anthropic-oauth] refresh failed', response.status);
    return row.access || null;
  }
  const json = (await response.json()) as { refresh_token: string; access_token: string; expires_in: number };
  const expires = Date.now() + json.expires_in * 1000 - ANTHROPIC_EXPIRES_SKEW_MS;
  await upsertAnthropicOAuth(json.access_token, json.refresh_token, expires);
  cached = { access: json.access_token, expires };
  return json.access_token;
}

/**
 * Return a valid access token for the shared subscription, refreshing centrally
 * (single-flight) when needed. Returns null when no credential is connected
 * (→ caller should fall back to the non-subscription path).
 */
export async function getValidAnthropicAccessToken(): Promise<string | null> {
  if (cached && cached.expires > Date.now() + ANTHROPIC_EXPIRES_SKEW_MS) return cached.access;
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = loadOrRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

/** True when a subscription credential is connected (drives the router path). */
export async function isAnthropicSubscriptionConnected(): Promise<boolean> {
  try {
    return (await getStoredAnthropicOAuth()) !== null;
  } catch {
    return false;
  }
}

/** Status for the admin panel (never exposes the tokens). */
export async function getAnthropicOAuthStatus(): Promise<{ connected: boolean; expiresAt: string | null; updatedAt: string | null }> {
  let row: AnthropicOAuthRow | null = null;
  try {
    row = await getStoredAnthropicOAuth();
  } catch {
    /* table missing */
  }
  return {
    connected: !!row,
    expiresAt: row ? new Date(row.expires).toISOString() : null,
    updatedAt: row ? row.updatedAt.toISOString() : null,
  };
}

/** Disconnect (admin) — wipe the stored credential + cache. */
export async function disconnectAnthropicOAuth(): Promise<void> {
  cached = null;
  await deleteAnthropicOAuth();
}
