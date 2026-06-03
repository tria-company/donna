/**
 * Per-user scoping of opencode sessions at the BACKEND proxy layer.
 *
 * Why here (and not in the sandbox): the sandbox image may be stale/upstream
 * and not carry the kortix-master session-ownership filter. Doing it in the
 * proxy makes "cada usuário só vê as próprias conversas" work regardless of the
 * sandbox version — it only needs the backend (apps/api) deploy.
 *
 * Model: when a session is created we stamp (session_id → account_id). When the
 * list is fetched we keep only the caller's own sessions. Sessions with no row
 * (legacy, criadas antes deste filtro) só aparecem pra admin de plataforma.
 */

import postgres from 'postgres';
import { config } from '../config';

let _sql: ReturnType<typeof postgres> | null = null;
function getSql() {
  if (!_sql) _sql = postgres(config.DATABASE_URL, { max: 3 });
  return _sql;
}

export async function stampSessionOwner(sessionId: string, accountId: string): Promise<void> {
  if (!sessionId || !accountId) return;
  try {
    await getSql()`
      INSERT INTO kortix.opencode_session_owner (session_id, account_id)
      VALUES (${sessionId}, ${accountId})
      ON CONFLICT (session_id) DO NOTHING
    `;
  } catch (err) {
    console.warn('[session-scope] stamp failed:', (err as Error).message);
  }
}

export async function ownerOf(sessionId: string): Promise<string | null> {
  const rows = await getSql()<{ account_id: string }[]>`
    SELECT account_id FROM kortix.opencode_session_owner WHERE session_id = ${sessionId} LIMIT 1
  `;
  return rows[0]?.account_id ?? null;
}

async function getOwners(sessionIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (sessionIds.length === 0) return map;
  const rows = await getSql()<{ session_id: string; account_id: string }[]>`
    SELECT session_id, account_id FROM kortix.opencode_session_owner
    WHERE session_id IN ${getSql()(sessionIds)}
  `;
  for (const r of rows) map.set(r.session_id, r.account_id);
  return map;
}

/**
 * Filter a raw opencode `/session` list response body to the caller's own
 * sessions. Fail-open: on any DB/parse error returns the body unchanged so a
 * transient failure never hides everyone's list (matches prior behavior).
 */
export async function scopeSessionList(
  rawBody: string,
  accountId: string,
  isAdmin: boolean,
): Promise<string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return rawBody;
  }
  const arr = Array.isArray(parsed) ? parsed : (parsed as { data?: unknown })?.data;
  if (!Array.isArray(arr)) return rawBody;

  try {
    const ids = arr
      .map((s) => (s as { id?: unknown })?.id)
      .filter((x): x is string => typeof x === 'string');
    const owners = await getOwners(ids);
    const visible = arr.filter((s) => {
      const owner = owners.get((s as { id?: string })?.id ?? '');
      if (!owner) return isAdmin; // legacy (sem dono) → só admin
      return owner === accountId; // carimbada → só o dono
    });
    return JSON.stringify(Array.isArray(parsed) ? visible : { ...(parsed as object), data: visible });
  } catch (err) {
    console.warn('[session-scope] filter failed, fail-open:', (err as Error).message);
    return rawBody;
  }
}
