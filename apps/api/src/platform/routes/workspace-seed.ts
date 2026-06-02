/**
 * Workspace-seed routes — mounted at /v1/workspace-seed (frontend / supabaseAuth).
 * Durable backup/restore of the account's user-created opencode project so
 * custom agents/skills/commands survive sandbox re-provisioning.
 *
 *   GET    /            — seed status { hasSeed, updatedAt, fileCount, byteSize }
 *   POST   /capture     — force-capture the active sandbox's project → DB
 *   POST   /restore     — force-restore the stored seed into the active sandbox
 *
 * Capture also runs automatically (debounced) whenever a session opens, and
 * restore runs automatically when a fresh sandbox is provisioned.
 */
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { supabaseAuth } from '../../middleware/auth';
import { resolveAccountId } from '../../shared/resolve-account';
import { getSeedMeta } from '../services/workspace-seed-store';
import { getActiveSandbox, captureSeed, restoreSeed } from '../services/workspace-seed';

export function createWorkspaceSeedRouter(): Hono {
  const router = new Hono();
  router.use('/*', supabaseAuth);

  router.get('/', async (c) => {
    const accountId = await resolveAccountId(c.get('userId') as string);
    const meta = await getSeedMeta(accountId).catch(() => null);
    return c.json({
      hasSeed: !!meta,
      updatedAt: meta?.updatedAt ?? null,
      fileCount: meta?.fileCount ?? 0,
      byteSize: meta?.byteSize ?? 0,
    });
  });

  router.post('/capture', async (c) => {
    const accountId = await resolveAccountId(c.get('userId') as string);
    const active = await getActiveSandbox(accountId);
    if (!active) throw new HTTPException(409, { message: 'Nenhum sandbox ativo para fazer backup.' });
    const r = await captureSeed(accountId, active.externalId, active.provider, { force: true });
    if (!r.captured) {
      throw new HTTPException(r.reason === 'empty' ? 422 : 502, {
        message:
          r.reason === 'empty'
            ? 'Nada para salvar: nenhum agente/skill/comando personalizado no sandbox.'
            : `Falha ao capturar (${r.reason ?? 'desconhecido'}).`,
      });
    }
    return c.json({ ok: true, fileCount: r.fileCount });
  });

  router.post('/restore', async (c) => {
    const accountId = await resolveAccountId(c.get('userId') as string);
    const active = await getActiveSandbox(accountId);
    if (!active) throw new HTTPException(409, { message: 'Nenhum sandbox ativo para restaurar.' });
    const ok = await restoreSeed(accountId, active.externalId, active.provider);
    if (!ok) throw new HTTPException(422, { message: 'Nada restaurado (sem backup salvo ou provider não suportado).' });
    return c.json({ ok: true });
  });

  return router;
}
