import { beforeEach, describe, expect, mock, test } from 'bun:test';

let mockedRows: Array<{ role: 'user' | 'admin' | 'super_admin' }> = [];
let emailRow: Array<{ email: string }> = [];

mock.module('../shared/db', () => ({
  hasDatabase: true,
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => mockedRows,
        }),
      }),
    }),
  },
}));

// Mock the `postgres` client used for the auth.users email lookup.
mock.module('postgres', () => ({
  default: () => {
    const sql: any = async () => emailRow;
    sql.end = async () => {};
    return sql;
  },
}));

const { getPlatformRole, isPlatformAdmin, __resetEmailCache } = await import('../shared/platform-roles');

describe('platform roles', () => {
  beforeEach(() => {
    mockedRows = [];
    emailRow = [];
    delete process.env.PLATFORM_ADMIN_EMAILS;
    process.env.DATABASE_URL = 'postgres://test';
    __resetEmailCache();
  });

  // ── DB-role path ──────────────────────────────────────────────────────────
  test('defaults to user when no role row exists', async () => {
    expect(await getPlatformRole('acc_1')).toBe('user');
    expect(await isPlatformAdmin('acc_1')).toBe(false);
  });

  test('returns admin when admin row exists', async () => {
    mockedRows = [{ role: 'admin' }];
    expect(await getPlatformRole('acc_2')).toBe('admin');
    expect(await isPlatformAdmin('acc_2')).toBe(true);
  });

  test('returns super_admin when super admin row exists', async () => {
    mockedRows = [{ role: 'super_admin' }];
    expect(await getPlatformRole('acc_3')).toBe('super_admin');
  });

  // ── Env-admin bootstrap (PLATFORM_ADMIN_EMAILS) ─────────────────────────────
  test('PLATFORM_ADMIN_EMAILS grants super_admin without a DB role row', async () => {
    process.env.PLATFORM_ADMIN_EMAILS = 'ferramentas@triacompany.com.br';
    emailRow = [{ email: 'ferramentas@triacompany.com.br' }];
    expect(await getPlatformRole('acc_admin')).toBe('super_admin');
    expect(await isPlatformAdmin('acc_admin')).toBe(true);
  });

  test('env admin match is case-insensitive', async () => {
    process.env.PLATFORM_ADMIN_EMAILS = 'Ferramentas@TriaCompany.com.br';
    emailRow = [{ email: 'ferramentas@triacompany.com.br' }];
    expect(await getPlatformRole('acc_ci')).toBe('super_admin');
  });

  test('email NOT in PLATFORM_ADMIN_EMAILS falls back to DB role', async () => {
    process.env.PLATFORM_ADMIN_EMAILS = 'someone@else.com';
    emailRow = [{ email: 'normal@user.com' }];
    mockedRows = []; // no DB role
    expect(await getPlatformRole('acc_user')).toBe('user');
  });

  test('supports a comma-separated admin list (with spaces)', async () => {
    process.env.PLATFORM_ADMIN_EMAILS = 'a@x.com, b@y.com ,c@z.com';
    emailRow = [{ email: 'b@y.com' }];
    expect(await getPlatformRole('acc_list')).toBe('super_admin');
  });

  test('empty PLATFORM_ADMIN_EMAILS does not grant admin', async () => {
    process.env.PLATFORM_ADMIN_EMAILS = '';
    emailRow = [{ email: 'anyone@x.com' }];
    mockedRows = [];
    expect(await getPlatformRole('acc_empty')).toBe('user');
  });
});
