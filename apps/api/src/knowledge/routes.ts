/**
 * Knowledge-base routes — mounted at /v1/knowledge (frontend / supabase-authed).
 * Account-scoped RAG: upload docs → chunk → embed (OpenAI) → pgvector.
 *
 *   POST   /documents        — multipart upload (file) → ingest
 *   GET    /documents        — list this account's docs
 *   DELETE /documents/:id    — delete a doc (+ chunks, cascade)
 *   POST   /search           — semantic search (for testing; agent uses the MCP tool)
 *   GET    /agents           — agent access flags (Phase 2 wires the per-agent permission)
 *   POST   /agents/:name/access  — toggle an agent's access
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { supabaseAuth } from '../middleware/auth';
import { resolveAccountId } from '../shared/resolve-account';
import { embedTexts, embedOne, embeddingsConfigured } from './embeddings';
import { extractFileText, chunkText } from './extract';
import {
  createDocument, insertChunks, finishDocument, listDocuments, deleteDocument, moveDocument,
  searchChunks, browseFolder,
  setDocumentAccess, getDocumentAccessMap,
} from './store';
import { applyKnowledgeToSandbox } from './inject';

export function createKnowledgeRouter(): Hono {
  const router = new Hono();
  router.use('/*', supabaseAuth);

  // ── Upload + ingest ─────────────────────────────────────────────────────────
  router.post('/documents', async (c) => {
    const accountId = await resolveAccountId(c.get('userId') as string);
    if (!embeddingsConfigured()) {
      throw new HTTPException(503, { message: 'OPENAI_API_KEY não configurado no servidor (necessário para embeddings).' });
    }
    const form = await c.req.formData().catch(() => null);
    const file = form?.get('file');
    if (!(file instanceof File)) throw new HTTPException(400, { message: 'Envie um arquivo no campo "file".' });

    const buf = new Uint8Array(await file.arrayBuffer());
    const title = (form?.get('title') as string) || file.name || 'Documento';
    // Optional folder → encoded in `source` as "<folder>/<filename>" (folders are
    // derived from the source path; there's no separate folder entity).
    const folder = String(form?.get('folder') || '').replace(/^\/+|\/+$/g, '').trim();
    const source = folder ? `${folder}/${file.name || title}` : (file.name || null);
    const docId = await createDocument(accountId, title, source, file.type || null, file.size || buf.length);

    try {
      const text = await extractFileText(buf, file.type || '', file.name || '');
      const { chunks, truncated } = chunkText(text);
      if (chunks.length === 0) {
        await finishDocument(docId, accountId, 'error', 0, 'Não consegui extrair texto do arquivo.');
        throw new HTTPException(422, { message: 'Não consegui extrair texto do arquivo (vazio ou formato não suportado).' });
      }
      const embeddings = await embedTexts(chunks.map((ch) => ch.content));
      await insertChunks(docId, accountId, chunks.map((ch, i) => ({ idx: ch.idx, content: ch.content, embedding: embeddings[i] })));
      await finishDocument(docId, accountId, 'indexed', chunks.length, truncated ? 'Truncado em 400 chunks (doc muito grande).' : null);
      return c.json({ doc_id: docId, status: 'indexed', chunk_count: chunks.length, truncated });
    } catch (err) {
      if (err instanceof HTTPException) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      await finishDocument(docId, accountId, 'error', 0, msg).catch(() => {});
      console.error('[KNOWLEDGE] ingest failed:', msg);
      throw new HTTPException(500, { message: `Falha ao indexar: ${msg.slice(0, 200)}` });
    }
  });

  // ── List ────────────────────────────────────────────────────────────────────
  router.get('/documents', async (c) => {
    const accountId = await resolveAccountId(c.get('userId') as string);
    return c.json({ items: await listDocuments(accountId) });
  });

  // ── Browse one folder level (lazy) ────────────────────────────────────────────
  router.get('/browse', async (c) => {
    const accountId = await resolveAccountId(c.get('userId') as string);
    const folder = String(c.req.query('folder') || '');
    return c.json(await browseFolder(accountId, folder));
  });

  // ── Delete ───────────────────────────────────────────────────────────────────
  router.delete('/documents/:id', async (c) => {
    const accountId = await resolveAccountId(c.get('userId') as string);
    const ok = await deleteDocument(c.req.param('id'), accountId);
    if (!ok) throw new HTTPException(404, { message: 'Documento não encontrado.' });
    return c.json({ ok: true });
  });

  // ── Move (reorganize into a folder) ──────────────────────────────────────────
  router.post('/documents/:id/move', async (c) => {
    const accountId = await resolveAccountId(c.get('userId') as string);
    const body = await c.req.json().catch(() => ({}));
    const parsed = z.object({ source: z.string().min(1).max(1024) }).safeParse(body);
    if (!parsed.success) throw new HTTPException(400, { message: 'source (novo caminho) é obrigatório.' });
    const ok = await moveDocument(c.req.param('id'), accountId, parsed.data.source.replace(/^\/+/, ''));
    if (!ok) throw new HTTPException(404, { message: 'Documento não encontrado.' });
    return c.json({ ok: true, source: parsed.data.source });
  });

  // ── Search (testing; the agent uses the MCP tool in Phase 2) ──────────────────
  router.post('/search', async (c) => {
    const accountId = await resolveAccountId(c.get('userId') as string);
    if (!embeddingsConfigured()) throw new HTTPException(503, { message: 'OPENAI_API_KEY não configurado.' });
    const body = await c.req.json().catch(() => ({}));
    const parsed = z.object({ query: z.string().min(1), k: z.number().int().min(1).max(20).optional() }).safeParse(body);
    if (!parsed.success) throw new HTTPException(400, { message: 'query é obrigatório.' });
    const emb = await embedOne(parsed.data.query);
    const results = await searchChunks(accountId, emb, parsed.data.k ?? 6);
    return c.json({ results });
  });

  // ── Per-document × per-agent access ───────────────────────────────────────
  // GET map { doc_id: [agentName] } so the UI can show which agents each doc is shared with.
  router.get('/documents/access', async (c) => {
    const accountId = await resolveAccountId(c.get('userId') as string);
    return c.json({ access: await getDocumentAccessMap(accountId) });
  });

  // POST { agents: string[] } → replace the set of agents that can access this document.
  router.post('/documents/:id/access', async (c) => {
    const accountId = await resolveAccountId(c.get('userId') as string);
    const body = await c.req.json().catch(() => ({}));
    const parsed = z.object({ agents: z.array(z.string()).max(50) }).safeParse(body);
    if (!parsed.success) throw new HTTPException(400, { message: 'agents (string[]) é obrigatório.' });
    await setDocumentAccess(accountId, c.req.param('id'), parsed.data.agents);
    let applied = false, reloaded = false;
    try {
      const r = await applyKnowledgeToSandbox(accountId);
      applied = r.applied; reloaded = r.reloaded;
      if (!r.ok) console.warn('[KNOWLEDGE] sandbox apply failed:', r.output);
    } catch (err) {
      console.warn('[KNOWLEDGE] sandbox apply error:', err instanceof Error ? err.message : String(err));
    }
    return c.json({ ok: true, doc_id: c.req.param('id'), agents: parsed.data.agents, applied, reloaded });
  });

  return router;
}
