# Donna (suna-new) — Mapa do projeto

Donna é um **agent OS** (fork do Kortix/Suna): cada usuário tem um agente de IA que roda num
**sandbox** (Daytona na nuvem ou Docker local) e conversa pela web. Monorepo **pnpm**: frontend
Next.js, backend Bun, runtime opencode. **UI e saídas do agente sempre em PT-BR.**

> Ambiente: Windows local + **Cloud Supabase** (produção, compartilhado) + **Daytona** (sandboxes).
> Detalhes e limites em "Fronteiras", no fim.

## Workspaces (onde fica cada coisa)
- `apps/web` — **frontend** (Next.js 15, Turbopack, :3000). Pacote `Kortix-Computer-Frontend`.
- `apps/api` — **backend** (Bun + Hono, :8008). Pacote `kortix-api` — monolito: router, billing, platform, cron, sandbox-proxy.
- `packages/db` — **schema do banco** (Drizzle, schema `kortix`) + client. `@kortix/db`.
- `packages/shared` — tipos/utilitários compartilhados (`@kortix/shared`).
- `core/kortix-master` — **runtime do agente** (opencode) que roda dentro do sandbox. `@kortix/sandbox-master`.
- `supabase/` — **migrations** SQL numeradas.
- `docs/` — specs e handoffs.
- `deploy/` — kit de deploy do **backend na VPS** (Docker + Caddy). Frontend vai pra Vercel.
- `apps/mobile`, `apps/desktop` — apps mobile (Expo) e desktop (Tauri).
- `scripts/`, `tests/` — orquestração do boot local e testes e2e.

## Roteamento (pra cada tarefa, vá aqui)
| Tarefa | Vá para | Leia |
|--------|---------|------|
| UI, telas, componentes | `apps/web` | `apps/web/CONTEXT.md` |
| API, rotas, integrações, billing | `apps/api` | `apps/api/CONTEXT.md` |
| Schema, tabelas, migrations | `packages/db` (+ `supabase/`) | `packages/db/CONTEXT.md` |
| Agente, opencode, MCP, sandbox | `core/kortix-master` | `core/kortix-master/CONTEXT.md` |
| Specs / decisões | `docs` | `docs/CONTEXT.md` |
| Deploy (Vercel + VPS) | `deploy/` + `docs/` | `docs/deploy-split-vercel-hosthatch.md` |
| App mobile | `apps/mobile` | `apps/mobile/README.md` |
| App desktop | `apps/desktop` | `apps/desktop/README.md` |

## Convenções de nome
- Arquivos de código: **kebab-case** (`session-chat-input.tsx`, `ensure-sandbox.ts`).
- Strings de usuário e saídas do agente: **PT-BR** sempre.
- Variáveis: PT quando refletem domínio; EN para padrões de framework.
- Specs em `docs/`: `nome-descritivo.md`.

## Comandos
| Ação | Comando |
|------|---------|
| Stack local completa | `pnpm dev` (roda `scripts/dev-local.sh`) |
| Só frontend (:3000) | `pnpm dev:web` |
| Só backend (:8008) | `pnpm dev:api` |
| Sandbox/core (docker) | `pnpm dev:core` |
| Build de tudo | `pnpm build` |

> Windows: o Docker usa named pipe; o boot local sobe um relay Node TCP→pipe (ver `scripts/dev-local.sh`).

## Fronteiras / estado atual
- **Supabase de produção é compartilhado** — mudança de schema só via migration numerada, rodada no SQL Editor (não escrever direto no banco).
- Sandboxes **Daytona têm egress restrito** (filtro de domínio/SNI) — o sandbox nem sempre alcança a API local.
- Não publicar pacotes npm. Não extrair credenciais do banco.
