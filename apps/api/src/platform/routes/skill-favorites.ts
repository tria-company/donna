/**
 * Rotas de skills favoritas — montadas em /v1/skill-favorites (frontend / supabaseAuth).
 * Favoritos por conta, persistidos em kortix.skill_favorites.
 *
 *   GET    /         — lista nomes favoritados { favorites: string[] }
 *   POST   /         — adiciona favorito { name }
 *   DELETE /:name    — remove favorito
 */
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { supabaseAuth } from '../../middleware/auth';
import { resolveAccountId } from '../../shared/resolve-account';
import { listFavorites, addFavorite, removeFavorite } from '../services/skill-favorites-store';

export function createSkillFavoritesRouter(): Hono {
  const router = new Hono();
  router.use('/*', supabaseAuth);

  router.get('/', async (c) => {
    const accountId = await resolveAccountId(c.get('userId') as string);
    const favorites = await listFavorites(accountId).catch(() => [] as string[]);
    return c.json({ favorites });
  });

  router.post('/', async (c) => {
    const accountId = await resolveAccountId(c.get('userId') as string);
    const body = await c.req.json().catch(() => ({}));
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) throw new HTTPException(400, { message: 'Nome da skill é obrigatório.' });
    await addFavorite(accountId, name);
    return c.json({ ok: true });
  });

  router.delete('/:name', async (c) => {
    const accountId = await resolveAccountId(c.get('userId') as string);
    const name = decodeURIComponent(c.req.param('name') || '').trim();
    if (!name) throw new HTTPException(400, { message: 'Nome da skill é obrigatório.' });
    await removeFavorite(accountId, name);
    return c.json({ ok: true });
  });

  return router;
}
