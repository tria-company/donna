/**
 * Composio v3 API client (MCP-based integrations).
 *
 * Replaces the Pipedream provider for this deployment. Each connected app is a
 * Composio "connected account" that we expose as an MCP server URL — injected
 * into the sandbox's opencode `mcp` config so the agent gains the toolkit's
 * tools natively.
 *
 * Base + key come from config (COMPOSIO_BASE_URL / COMPOSIO_API_KEY).
 * Auth: `x-api-key` header. Verified against https://backend.composio.dev/api/v3.
 */
import { config } from '../../config';

function apiBase(): string {
  return `${(config.COMPOSIO_BASE_URL || 'https://backend.composio.dev').replace(/\/+$/, '')}/api/v3`;
}

export function isComposioConfigured(): boolean {
  return !!config.COMPOSIO_API_KEY;
}

async function composioFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!config.COMPOSIO_API_KEY) {
    throw new Error('COMPOSIO_API_KEY is not configured');
  }
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      'x-api-key': config.COMPOSIO_API_KEY,
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  if (!res.ok) {
    const b = body as { message?: string; error?: string } | string | null;
    const msg = (b && typeof b === 'object' && (b.message || b.error)) || `Composio API error ${res.status}`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return body as T;
}

// ── Toolkits (apps) ───────────────────────────────────────────────────────
export interface ComposioToolkit {
  slug: string;
  name: string;
  description: string | null;
  logo: string | null;
  categories: string[];
  authSchemes: string[];
  noAuth: boolean;
  toolsCount: number | null;
}

function mapToolkit(t: any): ComposioToolkit {
  return {
    slug: t.slug,
    name: t.name,
    description: t.meta?.description ?? null,
    logo: t.meta?.logo ?? null,
    categories: (t.meta?.categories ?? []).map((c: any) => c?.name ?? c?.id).filter(Boolean),
    authSchemes: t.auth_schemes ?? [],
    noAuth: !!t.no_auth,
    toolsCount: t.meta?.tools_count ?? null,
  };
}

export async function listToolkits(
  opts: { search?: string; limit?: number; cursor?: string } = {},
): Promise<{ items: ComposioToolkit[]; nextCursor: string | null }> {
  const qs = new URLSearchParams();
  if (opts.search) qs.set('search', opts.search);
  qs.set('limit', String(opts.limit ?? 50));
  if (opts.cursor) qs.set('cursor', opts.cursor);
  const raw = await composioFetch<any>(`/toolkits?${qs.toString()}`);
  return { items: (raw.items ?? []).map(mapToolkit), nextCursor: raw.next_cursor ?? null };
}

export async function getToolkit(slug: string): Promise<unknown> {
  return composioFetch<unknown>(`/toolkits/${encodeURIComponent(slug)}`);
}

// ── Auth configs (one per toolkit, Composio-managed OAuth) ──────────────────
export async function findOrCreateAuthConfig(toolkitSlug: string): Promise<string> {
  try {
    const existing = await composioFetch<any>(
      `/auth_configs?toolkit_slug=${encodeURIComponent(toolkitSlug)}&limit=1`,
    );
    const found = (existing.items ?? [])[0];
    if (found?.id) return found.id;
  } catch {
    // fall through to create
  }
  const created = await composioFetch<any>(`/auth_configs`, {
    method: 'POST',
    body: JSON.stringify({
      toolkit: { slug: toolkitSlug },
      auth_config: { type: 'use_composio_managed_auth' },
    }),
  });
  const id = created.auth_config?.id ?? created.id;
  if (!id) throw new Error('Composio: could not resolve auth_config id');
  return id;
}

// ── Connected accounts (per-user connections) ───────────────────────────────
export interface ComposioConnection {
  id: string;
  status: string;
  redirectUrl: string | null;
}

function extractRedirectUrl(o: any): string | null {
  return (
    o?.redirect_url ??
    o?.redirectUrl ??
    o?.connection_data?.val?.redirectUrl ??
    o?.connection_data?.val?.redirect_url ??
    o?.connectionData?.redirectUrl ??
    null
  );
}

export async function initiateConnection(
  authConfigId: string,
  userId: string,
  callbackUrl?: string,
): Promise<ComposioConnection> {
  // Composio deprecated POST /connected_accounts for Composio-managed OAuth auth
  // configs ("ConnectedAccount_BadRequest", code 600). The supported path is now
  // POST /connected_accounts/link with auth_config_id + user_id, which returns a
  // redirect_url + connected_account_id for the end user to complete OAuth.
  const created = await composioFetch<any>(`/connected_accounts/link`, {
    method: 'POST',
    body: JSON.stringify({
      auth_config_id: authConfigId,
      user_id: userId,
      ...(callbackUrl ? { callback_url: callbackUrl } : {}),
    }),
  });
  return {
    id: created.connected_account_id ?? created.connectedAccountId ?? created.id ?? '',
    status: created.status ?? 'INITIATED',
    redirectUrl: extractRedirectUrl(created),
  };
}

export async function listConnections(userId: string): Promise<any[]> {
  const raw = await composioFetch<any>(
    `/connected_accounts?user_ids=${encodeURIComponent(userId)}&limit=100`,
  );
  return raw.items ?? [];
}

export async function deleteConnection(connectedAccountId: string): Promise<void> {
  await composioFetch(`/connected_accounts/${encodeURIComponent(connectedAccountId)}`, {
    method: 'DELETE',
  });
}

// ── MCP servers (the URL injected into the sandbox opencode config) ─────────
export async function createMcpServer(
  name: string,
  authConfigId: string,
  toolkitSlug: string,
): Promise<{ id: string; mcpUrl: string | null }> {
  const created = await composioFetch<any>(`/mcp/servers`, {
    method: 'POST',
    body: JSON.stringify({
      name,
      auth_config_ids: [authConfigId],
      toolkits: [toolkitSlug],
    }),
  });
  return { id: created.id, mcpUrl: created.mcp_url ?? created.url ?? null };
}

/** Look up an existing MCP server by its (unique-per-project) name. */
export async function findMcpServerByName(
  name: string,
): Promise<{ id: string; mcpUrl: string | null } | null> {
  const raw = await composioFetch<any>(`/mcp/servers?limit=100`);
  const found = (raw.items ?? []).find((s: any) => s.name === name);
  if (!found) return null;
  return { id: found.id, mcpUrl: found.mcp_url ?? found.url ?? null };
}

/**
 * Idempotent: return the existing MCP server for `name` (Composio rejects
 * duplicate names), else create it. Fixes the "MCP server already exists" error
 * on re-enable.
 */
export async function findOrCreateMcpServer(
  name: string,
  authConfigId: string,
  toolkitSlug: string,
): Promise<{ id: string; mcpUrl: string | null }> {
  const existing = await findMcpServerByName(name).catch(() => null);
  if (existing?.mcpUrl) return existing;
  return createMcpServer(name, authConfigId, toolkitSlug);
}
