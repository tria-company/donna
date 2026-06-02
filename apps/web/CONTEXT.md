# apps/web — Frontend (Next.js)

A interface web da Donna. Pacote `Kortix-Computer-Frontend`. Next.js 15 (App Router) + Turbopack,
React 18, Tailwind 4. Fala com o backend (`apps/api`, :8008) e renderiza o chat do agente, o
dashboard e a base de conhecimento. Roda em **:3000**.

## Estrutura (`src/`)
- `app/` — rotas do App Router. Grupos: `(home)` (marketing), `(dashboard)` (app logado).
- `components/` — componentes de UI. `components/ui/` = primitivos (Radix + shadcn); `components/dashboard/`, `components/session/`, `components/sidebar/` = features.
- `features/` — módulos maiores por domínio (ex.: `files/`).
- `hooks/` — React Query hooks (`hooks/donna/`, `hooks/opencode/`) + utilitários.
- `stores/` — estado global (Zustand).
- `i18n/` + `translations/` — internacionalização (next-intl). Locale padrão **PT-BR**.
- `lib/` — clients e helpers (`api-client.ts` → `backendApi`, auth, utils).
- `middleware.ts` — auth/redirect de rotas.

## Padrões que seguimos
- Dados do backend via **React Query** + `backendApi` (`lib/api-client.ts`: `.get/.post/.upload`). Nada de `fetch` solto.
- Componentes em **kebab-case**; um componente por arquivo; primitivos em `components/ui/`.
- **PT-BR em todo texto visível** e em toda saída do agente.
- Branding: o agente `general` aparece como **"donna"** (minúsculo) na UI — use os overrides existentes, não renomeie o agente real.
- Mutations otimistas via `queryClient.setQueryData` quando fizer sentido; invalidar a query certa no fim.

## Padrões que evitamos
- Strings em inglês na UI. Hardcode de URL do backend (use `backendApi`). Lógica de negócio dentro de componente — extraia pra hook/lib.

## Standards
- `pnpm dev:web` sobe em :3000; rode `pnpm --filter Kortix-Computer-Frontend lint` antes de fechar.
- Mudou contrato de API? Atualize o hook em `hooks/` e o tipo correspondente.

## Comandos
- Dev: `pnpm dev:web` · Lint: `next lint` · Format: `prettier --write .` · Build: `next build`
