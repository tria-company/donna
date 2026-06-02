import { platformUserRoles } from '@kortix/db';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import { db, hasDatabase } from './db';

export type PlatformRole = 'user' | 'admin' | 'super_admin';

// Emails configured as platform admins via env (PLATFORM_ADMIN_EMAILS) are
// super_admins regardless of the DB role. Lets a self-host operator bootstrap
// the first admin without writing to the database. Read per-call so tests (and
// runtime env reloads) take effect.
function getAdminEmails(): Set<string> {
  return new Set(
    (process.env.PLATFORM_ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

// accountId → email cache (avoids an auth.users lookup on every admin check).
const emailCache = new Map<string, string | null>();

/** Test-only: reset the accountId→email cache. */
export function __resetEmailCache() {
  emailCache.clear();
}

async function getAccountEmail(accountId: string): Promise<string | null> {
  if (emailCache.has(accountId)) return emailCache.get(accountId)!;
  let email: string | null = null;
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    // prepare:false → compatível com o transaction pooler do Supabase (porta 6543),
    // que não suporta prepared statements nomeados. Espelha packages/db client.ts.
    const sql = postgres(dbUrl, { max: 1, prepare: false });
    try {
      const [row] = await sql`SELECT email FROM auth.users WHERE id = ${accountId} LIMIT 1`;
      email = (row?.email as string | undefined)?.toLowerCase() ?? null;
    } catch {
      email = null;
    } finally {
      await sql.end();
    }
  }
  emailCache.set(accountId, email);
  return email;
}

export async function getPlatformRole(accountId: string): Promise<PlatformRole> {
  if (!hasDatabase) {
    return 'user';
  }

  // Env-based admin bootstrap (no DB row required).
  const adminEmails = getAdminEmails();
  if (adminEmails.size > 0) {
    const email = await getAccountEmail(accountId);
    if (email && adminEmails.has(email)) {
      return 'super_admin';
    }
  }

  const [row] = await db
    .select({ role: platformUserRoles.role })
    .from(platformUserRoles)
    .where(eq(platformUserRoles.accountId, accountId))
    .limit(1);

  if (row?.role === 'admin' || row?.role === 'super_admin') {
    return row.role;
  }

  return 'user';
}

export async function isPlatformAdmin(accountId: string): Promise<boolean> {
  const role = await getPlatformRole(accountId);
  return role === 'admin' || role === 'super_admin';
}
