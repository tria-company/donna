/**
 * DB layer para skills favoritadas por conta (kortix.skill_favorites).
 *
 * Favoritos são guardados por `skill_name` (estável dentro do workspace
 * opencode da conta). As queries são best-effort: se a tabela ainda não
 * existir (migration 36 não aplicada), os callers tratam o erro e seguem.
 */
import { sql } from 'drizzle-orm';
import { db } from '../../shared/db';

export async function listFavorites(accountId: string): Promise<string[]> {
  const rows: any = await db.execute(sql`
    SELECT skill_name
    FROM kortix.skill_favorites
    WHERE account_id = ${accountId}
    ORDER BY created_at DESC
  `);
  return (rows.rows ?? rows).map((r: any) => r.skill_name as string);
}

export async function addFavorite(accountId: string, skillName: string): Promise<void> {
  await db.execute(sql`
    INSERT INTO kortix.skill_favorites (account_id, skill_name)
    VALUES (${accountId}, ${skillName})
    ON CONFLICT (account_id, skill_name) DO NOTHING
  `);
}

export async function removeFavorite(accountId: string, skillName: string): Promise<void> {
  await db.execute(sql`
    DELETE FROM kortix.skill_favorites
    WHERE account_id = ${accountId} AND skill_name = ${skillName}
  `);
}
