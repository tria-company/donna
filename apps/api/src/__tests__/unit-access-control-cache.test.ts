import { afterEach, describe, expect, mock, test } from 'bun:test';

// Prevent the real DB module (which would connect) from loading. The gating
// functions under test don't touch the DB (the allowlist sets stay empty
// because refresh() is never called here). Shape matches the other unit tests'
// db mock (incl. hasDatabase) so the shared mock stays compatible when the whole
// unit-*.test.ts glob runs in one bun process.
mock.module('../shared/db', () => ({
  hasDatabase: true,
  db: { select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }) },
}));

const cache = await import('../shared/access-control-cache');

describe('access control gating', () => {
  afterEach(() => {
    delete process.env.SIGNUPS_ENABLED;
  });

  test('areSignupsEnabled defaults to true (fail-open) with no env override', () => {
    delete process.env.SIGNUPS_ENABLED;
    expect(cache.areSignupsEnabled()).toBe(true);
  });

  test('SIGNUPS_ENABLED=false forces invite-only', () => {
    process.env.SIGNUPS_ENABLED = 'false';
    expect(cache.areSignupsEnabled()).toBe(false);
  });

  test('SIGNUPS_ENABLED=true forces open signups', () => {
    process.env.SIGNUPS_ENABLED = 'true';
    expect(cache.areSignupsEnabled()).toBe(true);
  });

  test('canSignUp lets anyone in when signups are open', () => {
    process.env.SIGNUPS_ENABLED = 'true';
    expect(cache.canSignUp('random@person.com')).toBe(true);
  });

  test('canSignUp BLOCKS a non-allowlisted email when invite-only', () => {
    process.env.SIGNUPS_ENABLED = 'false';
    expect(cache.canSignUp('random@person.com')).toBe(false);
  });

  test('isEmailAllowed is false against an empty allowlist', () => {
    expect(cache.isEmailAllowed('x@y.com')).toBe(false);
  });
});
