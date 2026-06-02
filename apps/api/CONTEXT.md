# apps/api — Backend (Bun + Hono)

A API da Donna. Pacote `kortix-api` — **monolito** que junta router, billing, platform, cron e
sandbox-proxy num só servidor Hono. Roda em **Bun**, porta **:8008**, ESM.

## Estrutura (`src/`)
- `index.ts` — bootstrap do app Hono + **montagem de todas as rotas** (`app.route('/v1/...', router)`).
- `config.ts` — env vars tipadas. `ensure-schema.ts` — bootstrap do schema. `types.ts`, `errors.ts`.
- `middleware/` — auth e afins. `shared/` — db, helpers (`resolve-account`, `daytona`, caches).
- Domínios (uma pasta cada): `access-control/`, `admin/`, `billing/`, `deployments/`,
  `integrations/` (Composio etc.), `knowledge/` (RAG), `platform/` (sandboxes/Daytona),
  `sandbox-proxy/` (proxy → porta do sandbox), `tunnel/`, `teams/`, `permissions/`, `oauth/`,
  `secrets/`, `providers/`, `queue/`, `repositories/`, `servers/`, `terminal/`.

## Padrões que seguimos
- **Auth por middleware:** `supabaseAuth` valida o JWT → `c.set('userId')`; `apiKeyAuth` valida o
  `KORTIX_TOKEN` do sandbox → `c.set('accountId')`. Conta a partir do usuário: `resolveAccountId(c.get('userId'))`.
- **Montar rota nova:** crie `dominio/routes.ts` exportando um `Hono`; aplique o middleware de auth;
  monte em `index.ts` com `app.route('/v1/<dominio>', createXRouter())`. Espelhe um domínio existente (ex.: `integrations/composio/routes.ts`).
- SQL "cru" via `db.execute(sql\`...\`)` quando o tipo não é modelado pelo Drizzle (ex.: `vector`).
- Erros de cliente: `throw new HTTPException(status, { message })` (mensagem em **PT-BR**).

## Padrões que evitamos
- Lógica de domínio em `index.ts` (só bootstrap + montagem). Rota sem auth. Vazar credencial em log/resposta.

## Notas
- `c.get('userId'|'accountId')` gera um erro **benigno** de tsc ("No overload matches this call",
  `Variables` não tipadas) — roda normal no Bun. Não tente "consertar" tipando errado.
- O sandbox-proxy faz checagem de dono **no banco** antes de repassar; se o Supabase travar, o proxy
  pendura — ver `sandbox-proxy/routes/preview.ts`.

## Comandos
- Dev (hot): `pnpm dev:api` (:8008) · Typecheck: `bun run typecheck` (`tsc --noEmit`) · Testes: `bun test`
