/**
 * Knowledge MCP server — mounted at /v1/knowledge/mcp (sandbox / apiKeyAuth).
 *
 * A minimal MCP "Streamable HTTP" endpoint (the same transport context7's remote
 * MCP uses), implemented by hand as plain JSON-RPC over POST so we don't have to
 * bridge the @modelcontextprotocol/sdk Node transport into Hono/Bun.
 *
 * The sandbox's opencode injects this as a remote MCP server with
 *   Authorization: Bearer {env:KORTIX_TOKEN}
 * so apiKeyAuth resolves the calling account. The single tool `search` does an
 * account-scoped cosine search over the account's knowledge chunks.
 *
 * opencode namespaces MCP tools as `<server>_<tool>`, so with the server keyed
 * "knowledge" the agent sees the tool — and the permission key — as
 * `knowledge_search` (see inject.ts for the per-agent gating).
 */
import { Hono } from 'hono';
import { apiKeyAuth } from '../middleware/auth';
import { embedOne, embeddingsConfigured } from './embeddings';
import { searchChunks } from './store';

const PROTOCOL_VERSION = '2025-06-18';
const SERVER_INFO = { name: 'donna-knowledge', version: '1.0.0' };

const SEARCH_TOOL = {
  name: 'search',
  title: 'Buscar na base de conhecimento',
  description:
    'Busca semântica na base de conhecimento da conta (documentos enviados pelo usuário no painel). ' +
    'Use sempre que a pergunta puder depender de documentos, políticas, manuais ou dados internos da conta. ' +
    'Retorna os trechos mais relevantes com a fonte. Em português.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'A pergunta ou termos a buscar (em português).' },
      k: { type: 'number', description: 'Quantos trechos retornar (1-20, padrão 6).' },
    },
    required: ['query'],
  },
};

function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: '2.0', id, result };
}
function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

async function runSearch(accountId: string, args: any, agentName: string | null): Promise<{ content: { type: 'text'; text: string }[] }> {
  const query = typeof args?.query === 'string' ? args.query.trim() : '';
  if (!query) {
    return { content: [{ type: 'text', text: 'Erro: o parâmetro "query" é obrigatório.' }] };
  }
  if (!embeddingsConfigured()) {
    return { content: [{ type: 'text', text: 'Base de conhecimento indisponível: embeddings não configurados no servidor.' }] };
  }
  const k = Math.min(20, Math.max(1, Number(args?.k) || 6));
  const emb = await embedOne(query);
  // agentName (from the X-Kb-Agent header injected per-agent in the sandbox config)
  // restricts results to documents explicitly shared with that agent.
  const hits = await searchChunks(accountId, emb, k, agentName);
  if (hits.length === 0) {
    return { content: [{ type: 'text', text: 'Nenhum trecho relevante encontrado na base de conhecimento da conta.' }] };
  }
  const text = hits
    .map((h, i) => {
      const src = h.title || h.source || 'documento';
      const score = (h.score ?? 0).toFixed(3);
      return `[${i + 1}] (fonte: ${src} · relevância ${score})\n${h.content.trim()}`;
    })
    .join('\n\n---\n\n');
  return { content: [{ type: 'text', text }] };
}

/** Handle a single JSON-RPC message. Returns null for notifications (no reply). */
async function handleRpc(msg: any, accountId: string, agentName: string | null): Promise<any | null> {
  const { id, method, params } = msg ?? {};
  // Notifications have no id and expect no response.
  const isNotification = id === undefined || id === null;

  switch (method) {
    case 'initialize':
      return rpcResult(id, {
        protocolVersion: typeof params?.protocolVersion === 'string' ? params.protocolVersion : PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
      });

    case 'notifications/initialized':
    case 'notifications/cancelled':
      return null;

    case 'ping':
      return rpcResult(id, {});

    case 'tools/list':
      return rpcResult(id, { tools: [SEARCH_TOOL] });

    case 'tools/call': {
      const name = params?.name;
      if (name !== 'search' && name !== 'knowledge_search') {
        return rpcError(id, -32602, `Ferramenta desconhecida: ${name}`);
      }
      try {
        const result = await runSearch(accountId, params?.arguments ?? {}, agentName);
        return rpcResult(id, result);
      } catch (err) {
        const m = err instanceof Error ? err.message : String(err);
        return rpcResult(id, { content: [{ type: 'text', text: `Erro na busca: ${m.slice(0, 200)}` }], isError: true });
      }
    }

    default:
      if (isNotification) return null;
      return rpcError(id, -32601, `Método não suportado: ${method}`);
  }
}

export function createKnowledgeMcpRouter(): Hono {
  const router = new Hono();
  router.use('/*', apiKeyAuth);

  // Streamable HTTP: server→client SSE stream is optional; we don't open one.
  router.get('/', (c) => c.text('Method Not Allowed', 405));
  router.delete('/', (c) => c.json({ ok: true }));

  router.post('/', async (c) => {
    const accountId = c.get('accountId') as string;
    // Per-agent server injects this static header; identifies the calling agent
    // for per-document access filtering. Absent → account-wide (legacy).
    const agentName = c.req.header('X-Kb-Agent') || c.req.header('x-kb-agent') || null;
    const body = await c.req.json().catch(() => null);
    if (body == null) return c.json(rpcError(null, -32700, 'Parse error'), 400);

    if (Array.isArray(body)) {
      const out: any[] = [];
      for (const m of body) {
        const r = await handleRpc(m, accountId, agentName);
        if (r !== null) out.push(r);
      }
      // All notifications → 202 with no body.
      if (out.length === 0) return c.body(null, 202);
      return c.json(out);
    }

    const r = await handleRpc(body, accountId, agentName);
    if (r === null) return c.body(null, 202); // notification ack
    return c.json(r);
  });

  return router;
}
