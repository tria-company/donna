/**
 * Rotas de pastas de sessões — montadas em /v1/session-folders (supabaseAuth).
 *
 *   GET    /                      — { folders: [...], items: { sessionId: folderId } }
 *   POST   /            { name }   — cria pasta
 *   PATCH  /:id         { name }   — renomeia
 *   DELETE /:id                    — exclui (cascata nos itens)
 *   POST   /items { sessionId, folderId }  — move sessão (folderId null/'' = tira da pasta)
 */
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { supabaseAuth } from '../../middleware/auth';
import { resolveAccountId } from '../../shared/resolve-account';
import {
  listFolders,
  listItems,
  createFolder,
  renameFolder,
  deleteFolder,
  moveSession,
} from '../services/session-folders-store';

export function createSessionFoldersRouter(): Hono {
  const router = new Hono();
  router.use('/*', supabaseAuth);

  router.get('/', async (c) => {
    const accountId = await resolveAccountId(c.get('userId') as string);
    const [folders, items] = await Promise.all([
      listFolders(accountId).catch(() => []),
      listItems(accountId).catch(() => ({})),
    ]);
    return c.json({ folders, items });
  });

  router.post('/', async (c) => {
    const accountId = await resolveAccountId(c.get('userId') as string);
    const body = await c.req.json().catch(() => ({}));
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) throw new HTTPException(400, { message: 'Nome da pasta é obrigatório.' });
    return c.json(await createFolder(accountId, name));
  });

  router.patch('/:id', async (c) => {
    const accountId = await resolveAccountId(c.get('userId') as string);
    const body = await c.req.json().catch(() => ({}));
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) throw new HTTPException(400, { message: 'Nome da pasta é obrigatório.' });
    await renameFolder(accountId, c.req.param('id'), name);
    return c.json({ ok: true });
  });

  router.delete('/:id', async (c) => {
    const accountId = await resolveAccountId(c.get('userId') as string);
    await deleteFolder(accountId, c.req.param('id'));
    return c.json({ ok: true });
  });

  router.post('/items', async (c) => {
    const accountId = await resolveAccountId(c.get('userId') as string);
    const body = await c.req.json().catch(() => ({}));
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : '';
    const folderId = body?.folderId ? String(body.folderId) : null;
    if (!sessionId) throw new HTTPException(400, { message: 'sessionId é obrigatório.' });
    await moveSession(accountId, sessionId, folderId);
    return c.json({ ok: true });
  });

  return router;
}
