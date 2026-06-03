/**
 * Composio routes — mounted at /v1/composio (frontend / supabase-authed).
 *
 * MCP-profile integration flow:
 *   GET  /toolkits            — list available apps
 *   GET  /toolkits/:slug      — toolkit details
 *   POST /connect             — start OAuth for a toolkit → { redirect_url }
 *   GET  /connections         — list this account's connections
 *   DELETE /connections/:id   — remove a connection
 *
 * Connections are scoped by the Donna account id (used as Composio's user_id).
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { supabaseAuth } from '../../middleware/auth';
import { resolveAccountId } from '../../shared/resolve-account';
import * as composio from './client';
import { applyMcpToSandbox, getAccountSandboxExternalId, composioMcpEntry } from './mcp-inject';
import { upsertAccountMcp } from './mcp-store';

export function createComposioRouter(): Hono {
  const router = new Hono();
  router.use('/*', supabaseAuth);

  // ── List toolkits (apps) ──────────────────────────────────────────────────
  router.get('/toolkits', async (c) => {
    const search = c.req.query('q') || c.req.query('search') || undefined;
    const limit = parseInt(c.req.query('limit') || '50', 10);
    const cursor = c.req.query('cursor') || undefined;
    try {
      return c.json(await composio.listToolkits({ search, limit, cursor }));
    } catch (err) {
      // Not configured / upstream hiccup → empty list keeps the UI calm.
      console.warn('[COMPOSIO] listToolkits unavailable:', err instanceof Error ? err.message : err);
      return c.json({ items: [], nextCursor: null });
    }
  });

  // ── Toolkit details ───────────────────────────────────────────────────────
  router.get('/toolkits/:slug', async (c) => {
    try {
      return c.json(await composio.getToolkit(c.req.param('slug')));
    } catch (err) {
      throw new HTTPException(502, { message: err instanceof Error ? err.message : 'Composio error' });
    }
  });

  // ── Start a connection (OAuth) for a toolkit ──────────────────────────────
  router.post('/connect', async (c) => {
    const userId = c.get('userId') as string;
    const accountId = await resolveAccountId(userId);
    const body = await c.req.json().catch(() => ({}));
    const parsed = z
      .object({ toolkit_slug: z.string().min(1), callback_url: z.string().url().optional() })
      .safeParse(body);
    if (!parsed.success) throw new HTTPException(400, { message: 'toolkit_slug is required' });

    try {
      const authConfigId = await composio.findOrCreateAuthConfig(parsed.data.toolkit_slug);
      const conn = await composio.initiateConnection(authConfigId, accountId, parsed.data.callback_url);
      return c.json({
        connected_account_id: conn.id,
        status: conn.status,
        redirect_url: conn.redirectUrl,
        auth_config_id: authConfigId,
      });
    } catch (err) {
      console.error('[COMPOSIO] connect failed:', err instanceof Error ? err.message : err);
      throw new HTTPException(502, { message: err instanceof Error ? err.message : 'Composio connect failed' });
    }
  });

  // ── List this account's connections ───────────────────────────────────────
  router.get('/connections', async (c) => {
    const userId = c.get('userId') as string;
    const accountId = await resolveAccountId(userId);
    try {
      return c.json({ items: await composio.listConnections(accountId) });
    } catch (err) {
      console.warn('[COMPOSIO] listConnections unavailable:', err instanceof Error ? err.message : err);
      return c.json({ items: [] });
    }
  });

  // ── Enable a connection: create its MCP server + inject into the sandbox ───
  // Call this after the OAuth flow reports the connection ACTIVE. The toolkit's
  // tools then appear in the agent (opencode picks up the new MCP server).
  router.post('/connections/:id/enable', async (c) => {
    const userId = c.get('userId') as string;
    const accountId = await resolveAccountId(userId);
    const body = await c.req.json().catch(() => ({}));
    const parsed = z
      .object({ toolkit_slug: z.string().min(1), auth_config_id: z.string().min(1) })
      .safeParse(body);
    if (!parsed.success) {
      throw new HTTPException(400, { message: 'toolkit_slug and auth_config_id are required' });
    }

    const mcpName = `composio-${parsed.data.toolkit_slug}`;
    let mcpUrl: string | null;
    try {
      // Idempotente: reaproveita a MCP server se já existir (Composio rejeita nome
      // duplicado), senão cria. Resolve o erro "MCP server already exists" no re-enable.
      const mcp = await composio.findOrCreateMcpServer(
        `donna-${accountId.slice(0, 8)}-${parsed.data.toolkit_slug}`,
        parsed.data.auth_config_id,
        parsed.data.toolkit_slug,
      );
      mcpUrl = mcp.mcpUrl;
    } catch (err) {
      console.error('[COMPOSIO] findOrCreateMcpServer failed:', err instanceof Error ? err.message : err);
      throw new HTTPException(502, { message: err instanceof Error ? err.message : 'Composio MCP create failed' });
    }
    if (!mcpUrl) throw new HTTPException(502, { message: 'Composio did not return an MCP url' });

    // Persiste por conta → reinjetado em todo sandbox provisionado (durável).
    await upsertAccountMcp(accountId, mcpName, mcpUrl, parsed.data.toolkit_slug).catch((err) =>
      console.error('[COMPOSIO] upsertAccountMcp failed:', err instanceof Error ? err.message : err),
    );

    const externalId = await getAccountSandboxExternalId(accountId);
    if (!externalId) {
      // Sem sandbox ativo: já está persistido → aplica no próximo provision.
      return c.json({ success: true, mcp_url: mcpUrl, injected: false, persisted: true, message: 'Salvo; aplica no próximo sandbox' });
    }
    const result = await applyMcpToSandbox(externalId, {
      add: [composioMcpEntry(accountId, mcpName, mcpUrl)],
    });
    return c.json({ success: result.ok, mcp_url: mcpUrl, injected: result.ok, persisted: true, reloaded: result.reloaded });
  });

  // ── Remove a connection ───────────────────────────────────────────────────
  router.delete('/connections/:id', async (c) => {
    try {
      await composio.deleteConnection(c.req.param('id'));
      return c.json({ success: true });
    } catch (err) {
      throw new HTTPException(502, { message: err instanceof Error ? err.message : 'Composio error' });
    }
  });

  return router;
}
