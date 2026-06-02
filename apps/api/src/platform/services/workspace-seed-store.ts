/**
 * DB layer for the per-account workspace seed (durable backup of a sandbox's
 * user-created opencode project). One base64 tar.gz blob per account.
 *
 * All queries are wrapped by callers in try/catch and treated as best-effort:
 * if the table doesn't exist yet (migration 33 not applied), these throw and
 * the feature silently no-ops without breaking sandbox provisioning.
 */
import { sql } from 'drizzle-orm';
import { db } from '../../shared/db';

export interface SeedMeta {
  updatedAt: Date;
  byteSize: number;
  fileCount: number;
}

export async function getSeedMeta(accountId: string): Promise<SeedMeta | null> {
  const rows: any = await db.execute(sql`
    SELECT updated_at, byte_size, file_count
    FROM kortix.account_workspace_seed
    WHERE account_id = ${accountId}
    LIMIT 1
  `);
  const r = (rows.rows ?? rows)[0];
  if (!r) return null;
  return { updatedAt: new Date(r.updated_at), byteSize: Number(r.byte_size), fileCount: Number(r.file_count) };
}

export async function getSeedArchive(accountId: string): Promise<string | null> {
  const rows: any = await db.execute(sql`
    SELECT archive_b64 FROM kortix.account_workspace_seed WHERE account_id = ${accountId} LIMIT 1
  `);
  const r = (rows.rows ?? rows)[0];
  return r?.archive_b64 ?? null;
}

export async function upsertSeed(
  accountId: string,
  archiveB64: string,
  byteSize: number,
  fileCount: number,
): Promise<void> {
  await db.execute(sql`
    INSERT INTO kortix.account_workspace_seed (account_id, archive_b64, byte_size, file_count, updated_at)
    VALUES (${accountId}, ${archiveB64}, ${byteSize}, ${fileCount}, now())
    ON CONFLICT (account_id)
    DO UPDATE SET archive_b64 = ${archiveB64}, byte_size = ${byteSize}, file_count = ${fileCount}, updated_at = now()
  `);
}
