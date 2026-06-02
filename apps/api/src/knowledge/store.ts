/**
 * DB layer for the RAG knowledge base — raw SQL via drizzle's `sql` because the
 * `vector` type isn't modeled by drizzle-kit. Everything is scoped by account_id.
 */
import { sql } from 'drizzle-orm';
import { db } from '../shared/db';
import { toVectorLiteral } from './embeddings';

export interface KbDocument {
  doc_id: string;
  title: string;
  source: string | null;
  mime: string | null;
  bytes: number | null;
  status: string;
  error: string | null;
  chunk_count: number;
  created_at: string;
}

export async function createDocument(
  accountId: string,
  title: string,
  source: string | null,
  mime: string | null,
  bytes: number | null,
): Promise<string> {
  const rows: any = await db.execute(sql`
    INSERT INTO kortix.knowledge_documents (account_id, title, source, mime, bytes, status)
    VALUES (${accountId}, ${title}, ${source}, ${mime}, ${bytes}, 'processing')
    RETURNING doc_id
  `);
  return (rows[0] ?? rows.rows?.[0]).doc_id as string;
}

export async function insertChunks(
  docId: string,
  accountId: string,
  chunks: { idx: number; content: string; embedding: number[] }[],
): Promise<void> {
  for (const ch of chunks) {
    await db.execute(sql`
      INSERT INTO kortix.knowledge_chunks (doc_id, account_id, idx, content, embedding)
      VALUES (${docId}, ${accountId}, ${ch.idx}, ${ch.content}, ${toVectorLiteral(ch.embedding)}::vector)
    `);
  }
}

export async function finishDocument(
  docId: string,
  accountId: string,
  status: 'indexed' | 'error',
  chunkCount: number,
  error?: string | null,
): Promise<void> {
  await db.execute(sql`
    UPDATE kortix.knowledge_documents
    SET status = ${status}, chunk_count = ${chunkCount}, error = ${error ?? null}
    WHERE doc_id = ${docId} AND account_id = ${accountId}
  `);
}

export async function listDocuments(accountId: string): Promise<KbDocument[]> {
  const rows: any = await db.execute(sql`
    SELECT doc_id, title, source, mime, bytes, status, error, chunk_count, created_at
    FROM kortix.knowledge_documents
    WHERE account_id = ${accountId}
    ORDER BY created_at DESC
    LIMIT 500
  `);
  return (rows.rows ?? rows) as KbDocument[];
}

export async function deleteDocument(docId: string, accountId: string): Promise<boolean> {
  const rows: any = await db.execute(sql`
    DELETE FROM kortix.knowledge_documents
    WHERE doc_id = ${docId} AND account_id = ${accountId}
    RETURNING doc_id
  `);
  const arr = rows.rows ?? rows;
  return arr.length > 0;
}

/** Move a document to a new source path (folder reorganization). */
export async function moveDocument(docId: string, accountId: string, source: string): Promise<boolean> {
  const rows: any = await db.execute(sql`
    UPDATE kortix.knowledge_documents SET source = ${source}
    WHERE doc_id = ${docId} AND account_id = ${accountId}
    RETURNING doc_id
  `);
  return (rows.rows ?? rows).length > 0;
}

export interface SearchHit {
  content: string;
  title: string;
  source: string | null;
  score: number;
}

export async function searchChunks(
  accountId: string,
  queryEmbedding: number[],
  k: number,
  agentName?: string | null,
): Promise<SearchHit[]> {
  const qv = `${toVectorLiteral(queryEmbedding)}`;
  // When an agent is given, restrict to documents explicitly shared with that
  // agent (per-document × per-agent access). No agent → account-wide (legacy).
  const accessFilter = agentName
    ? sql`AND c.doc_id IN (
        SELECT doc_id FROM kortix.knowledge_document_access
        WHERE account_id = ${accountId} AND agent_name = ${agentName}
      )`
    : sql``;
  const rows: any = await db.execute(sql`
    SELECT c.content, d.title, d.source,
           1 - (c.embedding <=> ${qv}::vector) AS score
    FROM kortix.knowledge_chunks c
    JOIN kortix.knowledge_documents d ON d.doc_id = c.doc_id
    WHERE c.account_id = ${accountId} AND c.embedding IS NOT NULL
    ${accessFilter}
    ORDER BY c.embedding <=> ${qv}::vector
    LIMIT ${k}
  `);
  return (rows.rows ?? rows) as SearchHit[];
}

// ── folder browse (lazy, one level at a time) ─────────────────────────────────

export interface BrowseFile {
  doc_id: string;
  title: string;
  source: string | null;
  status: string;
  chunk_count: number;
  error: string | null;
  agents: string[];
}
export interface BrowseResult {
  folders: { name: string; count: number }[];
  files: BrowseFile[];
}

/**
 * List the immediate subfolders (with recursive doc counts) and the files
 * directly inside `folder` (path relative to the account's knowledge root,
 * derived from each document's `source`). Returns only this one level — the UI
 * loads folders lazily instead of pulling every document at once.
 */
export async function browseFolder(accountId: string, folder: string): Promise<BrowseResult> {
  const f = folder.replace(/^\/+|\/+$/g, '');
  const filesSelect = sql`
    d.doc_id, d.title, d.source, d.status, d.chunk_count, d.error,
    coalesce(array_agg(a.agent_name) FILTER (WHERE a.agent_name IS NOT NULL), '{}') AS agents`;

  if (!f) {
    const subs: any = await db.execute(sql`
      SELECT split_part(source, '/', 1) AS name, count(*)::int AS count
      FROM kortix.knowledge_documents
      WHERE account_id = ${accountId} AND source LIKE '%/%'
      GROUP BY 1 ORDER BY 1
    `);
    const files: any = await db.execute(sql`
      SELECT ${filesSelect}
      FROM kortix.knowledge_documents d
      LEFT JOIN kortix.knowledge_document_access a ON a.doc_id = d.doc_id AND a.account_id = d.account_id
      WHERE d.account_id = ${accountId} AND (d.source IS NULL OR d.source NOT LIKE '%/%')
      GROUP BY d.doc_id ORDER BY d.title
    `);
    return { folders: (subs.rows ?? subs) as any, files: (files.rows ?? files) as BrowseFile[] };
  }

  const prefix = f + '/';
  const subs: any = await db.execute(sql`
    SELECT split_part(substring(source from char_length(${prefix}) + 1), '/', 1) AS name, count(*)::int AS count
    FROM kortix.knowledge_documents
    WHERE account_id = ${accountId} AND starts_with(source, ${prefix})
      AND position('/' in substring(source from char_length(${prefix}) + 1)) > 0
    GROUP BY 1 ORDER BY 1
  `);
  const files: any = await db.execute(sql`
    SELECT ${filesSelect}
    FROM kortix.knowledge_documents d
    LEFT JOIN kortix.knowledge_document_access a ON a.doc_id = d.doc_id AND a.account_id = d.account_id
    WHERE d.account_id = ${accountId} AND starts_with(d.source, ${prefix})
      AND position('/' in substring(d.source from char_length(${prefix}) + 1)) = 0
    GROUP BY d.doc_id ORDER BY d.title
  `);
  return { folders: (subs.rows ?? subs) as any, files: (files.rows ?? files) as BrowseFile[] };
}

// ── per-document × per-agent access ───────────────────────────────────────────

/** Replace the full set of agents that can access a document. */
export async function setDocumentAccess(accountId: string, docId: string, agentNames: string[]): Promise<void> {
  await db.execute(sql`
    DELETE FROM kortix.knowledge_document_access
    WHERE account_id = ${accountId} AND doc_id = ${docId}
  `);
  for (const name of [...new Set(agentNames.map((s) => s.trim()).filter(Boolean))]) {
    await db.execute(sql`
      INSERT INTO kortix.knowledge_document_access (account_id, doc_id, agent_name)
      VALUES (${accountId}, ${docId}, ${name})
      ON CONFLICT (account_id, doc_id, agent_name) DO NOTHING
    `);
  }
}

/** Map of doc_id → [agentName] for this account (for the UI). */
export async function getDocumentAccessMap(accountId: string): Promise<Record<string, string[]>> {
  const rows: any = await db.execute(sql`
    SELECT doc_id, agent_name FROM kortix.knowledge_document_access WHERE account_id = ${accountId}
  `);
  const map: Record<string, string[]> = {};
  for (const r of (rows.rows ?? rows)) (map[r.doc_id] ??= []).push(r.agent_name);
  return map;
}

/** Distinct agent names that can access at least one document (for injection). */
export async function getAgentsWithDocAccess(accountId: string): Promise<string[]> {
  const rows: any = await db.execute(sql`
    SELECT DISTINCT agent_name FROM kortix.knowledge_document_access WHERE account_id = ${accountId}
  `);
  return (rows.rows ?? rows).map((r: any) => r.agent_name as string);
}
