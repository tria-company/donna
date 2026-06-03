/**
 * DB layer para os MCP servers Composio habilitados por conta.
 * Guarda nome + URL de cada app habilitado, pra reinjetar no opencode quando um
 * sandbox é provisionado (durabilidade). Best-effort: se a tabela não existir
 * (migration 37 não aplicada), os callers tratam o erro e seguem.
 */
import { sql } from 'drizzle-orm';
import { db } from '../../shared/db';

export interface SavedMcp {
  name: string;
  url: string;
  toolkitSlug: string;
}

export async function listAccountMcp(accountId: string): Promise<SavedMcp[]> {
  const rows: any = await db.execute(sql`
    SELECT name, url, toolkit_slug
    FROM kortix.composio_mcp_servers
    WHERE account_id = ${accountId}
    ORDER BY created_at ASC
  `);
  return (rows.rows ?? rows).map((r: any) => ({
    name: r.name as string,
    url: r.url as string,
    toolkitSlug: r.toolkit_slug as string,
  }));
}

export async function upsertAccountMcp(
  accountId: string,
  name: string,
  url: string,
  toolkitSlug: string,
): Promise<void> {
  await db.execute(sql`
    INSERT INTO kortix.composio_mcp_servers (account_id, name, url, toolkit_slug)
    VALUES (${accountId}, ${name}, ${url}, ${toolkitSlug})
    ON CONFLICT (account_id, name)
    DO UPDATE SET url = ${url}, toolkit_slug = ${toolkitSlug}, updated_at = now()
  `);
}

export async function removeAccountMcp(accountId: string, name: string): Promise<void> {
  await db.execute(sql`
    DELETE FROM kortix.composio_mcp_servers
    WHERE account_id = ${accountId} AND name = ${name}
  `);
}
