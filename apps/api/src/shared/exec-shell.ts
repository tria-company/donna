import { existsSync } from 'fs';

/**
 * Shell to use for `execSync` calls that run POSIX-style command strings
 * (e.g. `docker exec ... bash -c '<heredoc>'`).
 *
 * On Windows, Node's execSync defaults to cmd.exe, which cannot parse POSIX
 * single-quoting or bash heredocs — so `docker exec ... bash -c '...'` is
 * mangled and fails. Routing those commands through Git Bash makes them work.
 * On non-Windows this is `undefined`, so execSync keeps its default shell.
 */
export const DOCKER_EXEC_SHELL: string | undefined = (() => {
  if (process.platform !== 'win32') return undefined;
  const candidates = [
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return undefined;
})();
