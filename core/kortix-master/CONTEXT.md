# core/kortix-master — Runtime do agente (opencode)

O processo que roda **dentro do sandbox** (Daytona/Docker) e executa o agente via **opencode**.
Pacote `@kortix/sandbox-master` (Bun + Hono). Expõe o servidor opencode (porta 4096/8000 no sandbox)
que `apps/api` alcança pelo sandbox-proxy. Inclui canais (Telegram/Slack/Discord) e triggers.

## Estrutura
- `src/` — servidor e lógica do runtime (`bun run --watch src/index.ts`).
- `opencode/` — **configuração do agente** (baked na imagem do sandbox):
  - `agents/` — **agentes em `.md`**. Frontmatter: `mode: primary|subagent|all`, `permission`, `tools`.
  - `tools/`, `commands/`, `skills/` — ferramentas, comandos e skills do agente.
  - `opencode.jsonc` — config principal: mapa `mcp` (servidores MCP `type:remote`, `url`, `headers`, interpolação `{env:VAR}`), modelos, permissões.
  - `ocx.jsonc`, `donna-system.md`, `kortix-system.md` — system prompts e registro ocx.
  - `plugin/`, `patches/` — plugins e patches do opencode.
- `channels/`, `triggers/` — adapters de mensageria e gatilhos. `s6-services/` (em `core/`) supervisiona os processos.

## Padrões que seguimos
- **Permissão de tool** = chave `<servidor>_<tool>` em `permission` (global `deny` + allow por agente).
- MCP por conta/agente é injetado em runtime por `apps/api` (`knowledge/inject.ts`); o que está no
  `opencode.jsonc` é o **default da imagem**.
- **Durabilidade:** o sandbox novo só herda mudanças após **rebuild da imagem**; o sandbox ativo é
  corrigido ao vivo (injeção + reload).
- **Reload** após mudar config: `POST localhost:4096/instance/dispose`. Sanidade: `GET /config/status` deve dar `{valid:true, skippedSources:[]}`.

## Padrões que evitamos
- Editar config só no sandbox ativo e esquecer da imagem (perde na próxima provisão). Texto/UX em inglês.

## Comandos
- Dev local do core: `pnpm dev:core` (docker compose). Testes: `bun test` (`tests/unit|integration|e2e`).
