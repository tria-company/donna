# packages/db — Schema do banco (Drizzle)

Schemas Drizzle ORM + client Postgres compartilhados pelo monorepo (`@kortix/db`). Consumido
principalmente por `apps/api`. O banco é **Cloud Supabase** (Postgres).

## Estrutura (`src/`)
- `client.ts` — client Postgres (`postgres` + drizzle). Export `./client`.
- `schema/kortix.ts` — schema **`kortix`** (pgSchema): tabelas da aplicação.
- `schema/public.ts` — tabelas no schema `public` (auth/Supabase).
- `schema/legacy/` — schema antigo (compat). `schema/index.ts` reexporta tudo.
- `types.ts` — tipos derivados. Exports do pacote: `.`, `./client`, `./schema`, `./schema/legacy`, `./types`.

## Migrations (convenção do repo)
- A fonte de verdade das migrations é **`supabase/migrations/`**, em arquivos **numerados**
  (`00000000000034_knowledge_document_access.sql`, …) — **um statement por arquivo**.
- Nova tabela: adicione ao `schema/kortix.ts` (quando o tipo é modelável) **e** crie a migration SQL numerada.
- `vector`/pgvector **não é modelado** pelo Drizzle → crie a coluna + índice via **SQL cru** na migration; nas queries use `sql\`embedding <=> ...\``.
- **Supabase de produção é compartilhado:** não rode DDL direto pelo assistente — prepare o SQL e rode no **SQL Editor** do Supabase.

## Padrões que evitamos
- Editar migration já aplicada (crie uma nova). Misturar vários statements num arquivo de migration.

## Comandos
- Gerar diff Drizzle: `pnpm --filter @kortix/db db:generate`
- Push (force, dev): `db:push` · Studio: `db:studio` · Typecheck: `bun run typecheck`
