/**
 * DB layer for the single shared Claude Pro/Max OAuth credential.
 * Raw SQL (mirrors workspace-seed-store.ts). One row, id = 'default'.
 *
 * Best-effort: if the table doesn't exist yet (migration 35 not applied), these
 * throw and callers treat the credential as absent (subscription mode off).
 */
import { sql } from 'drizzle-orm';
import { db } from '../shared/db';

export interface AnthropicOAuthRow {
  access: string;
  refresh: string;
  expires: number; // epoch ms
  updatedAt: Date;
}

export async function getStoredAnthropicOAuth(): Promise<AnthropicOAuthRow | null> {
  const rows: any = await db.execute(sql`
    SELECT access, refresh, expires, updated_at
    FROM kortix.platform_anthropic_oauth
    WHERE id = 'default'
    LIMIT 1
  `);
  const r = (rows.rows ?? rows)[0];
  if (!r) return null;
  return {
    access: r.access,
    refresh: r.refresh,
    expires: Number(r.expires),
    updatedAt: new Date(r.updated_at),
  };
}

export async function upsertAnthropicOAuth(
  access: string,
  refresh: string,
  expires: number,
): Promise<void> {
  await db.execute(sql`
    INSERT INTO kortix.platform_anthropic_oauth (id, access, refresh, expires, updated_at)
    VALUES ('default', ${access}, ${refresh}, ${expires}, now())
    ON CONFLICT (id)
    DO UPDATE SET access = ${access}, refresh = ${refresh}, expires = ${expires}, updated_at = now()
  `);
}

export async function deleteAnthropicOAuth(): Promise<void> {
  await db.execute(sql`DELETE FROM kortix.platform_anthropic_oauth WHERE id = 'default'`);
}
