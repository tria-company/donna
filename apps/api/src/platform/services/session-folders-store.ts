/**
 * DB layer para pastas de sessões (kortix.session_folders + session_folder_items).
 * Account-scoped. Best-effort: se a migration 38 não estiver aplicada, os callers
 * tratam o erro.
 */
import { sql } from 'drizzle-orm';
import { db } from '../../shared/db';

export interface SessionFolder {
  id: string;
  name: string;
  position: number;
}

export async function listFolders(accountId: string): Promise<SessionFolder[]> {
  const rows: any = await db.execute(sql`
    SELECT id, name, position
    FROM kortix.session_folders
    WHERE account_id = ${accountId}
    ORDER BY position ASC, created_at ASC
  `);
  return (rows.rows ?? rows).map((r: any) => ({ id: r.id, name: r.name, position: Number(r.position) }));
}

/** Mapa sessionId → folderId. */
export async function listItems(accountId: string): Promise<Record<string, string>> {
  const rows: any = await db.execute(sql`
    SELECT session_id, folder_id FROM kortix.session_folder_items WHERE account_id = ${accountId}
  `);
  const map: Record<string, string> = {};
  for (const r of (rows.rows ?? rows)) map[r.session_id] = r.folder_id;
  return map;
}

export async function createFolder(accountId: string, name: string): Promise<SessionFolder> {
  const rows: any = await db.execute(sql`
    INSERT INTO kortix.session_folders (account_id, name, position)
    VALUES (${accountId}, ${name}, COALESCE((SELECT MAX(position) + 1 FROM kortix.session_folders WHERE account_id = ${accountId}), 0))
    RETURNING id, name, position
  `);
  const r = (rows.rows ?? rows)[0];
  return { id: r.id, name: r.name, position: Number(r.position) };
}

export async function renameFolder(accountId: string, folderId: string, name: string): Promise<void> {
  await db.execute(sql`
    UPDATE kortix.session_folders SET name = ${name}, updated_at = now()
    WHERE id = ${folderId} AND account_id = ${accountId}
  `);
}

export async function deleteFolder(accountId: string, folderId: string): Promise<void> {
  // ON DELETE CASCADE remove os itens.
  await db.execute(sql`
    DELETE FROM kortix.session_folders WHERE id = ${folderId} AND account_id = ${accountId}
  `);
}

/** Move uma sessão para uma pasta; folderId null/'' remove da pasta. */
export async function moveSession(accountId: string, sessionId: string, folderId: string | null): Promise<void> {
  if (!folderId) {
    await db.execute(sql`
      DELETE FROM kortix.session_folder_items WHERE account_id = ${accountId} AND session_id = ${sessionId}
    `);
    return;
  }
  await db.execute(sql`
    INSERT INTO kortix.session_folder_items (account_id, session_id, folder_id)
    VALUES (${accountId}, ${sessionId}, ${folderId})
    ON CONFLICT (account_id, session_id) DO UPDATE SET folder_id = ${folderId}, created_at = now()
  `);
}
