/**
 * One-off: dar uma senha padrão aos usuários que já existem.
 *
 * Por quê:
 *   O login da Donna passou a ser SÓ por senha (sem magic-link). Mas as contas
 *   antigas foram criadas por magic-link e NÃO têm senha — então ficariam
 *   trancadas pra fora. Este script seta a senha padrão `Tria@2026` e marca
 *   `must_change_password: true` em cada uma, pra todo mundo conseguir entrar e
 *   ser convidado a trocar a senha no primeiro acesso.
 *
 * Seguro:
 *   - Dry-run por padrão (só lista). Use `--apply` pra efetivar.
 *   - Por padrão atualiza TODOS (garante que ninguém fique sem senha no corte
 *     pra login-só-senha). `--skip-changed` pula quem já tem
 *     `must_change_password === false` — use só DEPOIS do lançamento, quando o
 *     flag passa a significar "a pessoa já definiu a própria senha".
 *   - `--email <addr>` mira um único usuário.
 *
 * Uso:
 *   bun run scripts/backfill-default-passwords.ts                 # dry run (todos)
 *   bun run scripts/backfill-default-passwords.ts --apply         # efetiva (todos)
 *   bun run scripts/backfill-default-passwords.ts --apply --skip-changed
 *   bun run scripts/backfill-default-passwords.ts --email a@b.com --apply
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_PASSWORD = 'Tria@2026';

if (!SUPABASE_URL || !SERVICE_ROLE) {
  throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios (carregue o .env do apps/api).');
}

const apply = process.argv.includes('--apply');
const skipChanged = process.argv.includes('--skip-changed');
const emailIdx = process.argv.indexOf('--email');
const onlyEmail = emailIdx >= 0 ? process.argv[emailIdx + 1]?.trim().toLowerCase() : null;

const supa = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type AuthUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown> | null;
};

async function listAllUsers(): Promise<AuthUser[]> {
  const all: AuthUser[] = [];
  let page = 1;
  const perPage = 1000;
  // listUsers é paginado; itera até a página vir vazia.
  for (;;) {
    const { data, error } = await supa.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers falhou (page ${page}): ${error.message}`);
    const users = (data?.users ?? []) as AuthUser[];
    all.push(...users);
    if (users.length < perPage) break;
    page += 1;
  }
  return all;
}

async function main() {
  console.log(`\n${apply ? '🔧 APPLY' : '🔍 DRY-RUN'} — senha padrão "${DEFAULT_PASSWORD}"${onlyEmail ? ` — alvo: ${onlyEmail}` : ' — todos os usuários'}${skipChanged ? ' — pulando quem já trocou' : ''}\n`);

  let users = await listAllUsers();
  if (onlyEmail) users = users.filter((u) => u.email?.toLowerCase() === onlyEmail);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const u of users) {
    const alreadyDone = u.user_metadata?.must_change_password === false;
    if (skipChanged && alreadyDone) {
      console.log(`  ⏭️  skip   ${u.email ?? u.id} (já definiu a própria senha)`);
      skipped += 1;
      continue;
    }

    if (!apply) {
      console.log(`  •  would update ${u.email ?? u.id}`);
      updated += 1;
      continue;
    }

    const { error } = await supa.auth.admin.updateUserById(u.id, {
      password: DEFAULT_PASSWORD,
      user_metadata: { ...(u.user_metadata ?? {}), must_change_password: true },
    });
    if (error) {
      console.error(`  ❌  fail   ${u.email ?? u.id}: ${error.message}`);
      failed += 1;
    } else {
      console.log(`  ✅  set    ${u.email ?? u.id}`);
      updated += 1;
    }
  }

  console.log(`\n${apply ? 'Atualizados' : 'Seriam atualizados'}: ${updated} · pulados: ${skipped} · falhas: ${failed} · total: ${users.length}`);
  if (!apply) console.log('\nNada foi alterado. Rode de novo com --apply pra efetivar.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
