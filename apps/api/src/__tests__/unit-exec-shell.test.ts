import { describe, expect, test } from 'bun:test';

const { DOCKER_EXEC_SHELL } = await import('../shared/exec-shell');

describe('exec-shell (docker exec shell selection)', () => {
  test('non-win32 → undefined (use default shell); win32 → a bash path (or undefined if Git Bash absent)', () => {
    if (process.platform === 'win32') {
      const ok = DOCKER_EXEC_SHELL === undefined || DOCKER_EXEC_SHELL.toLowerCase().includes('bash');
      expect(ok).toBe(true);
    } else {
      expect(DOCKER_EXEC_SHELL).toBeUndefined();
    }
  });

  test('when set, it points at an existing executable', () => {
    if (DOCKER_EXEC_SHELL) {
      const { existsSync } = require('fs');
      expect(existsSync(DOCKER_EXEC_SHELL)).toBe(true);
    } else {
      expect(DOCKER_EXEC_SHELL).toBeUndefined();
    }
  });
});
