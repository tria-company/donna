/**
 * Provider-agnostic command execution inside a sandbox.
 *
 * Donna fork: the original injection helpers (composio MCP, knowledge RAG) were
 * hardcoded to the Daytona SDK and broke on the VPS (which runs `local_docker`).
 * This unifies command exec across providers:
 *   - daytona      → Daytona SDK `process.executeCommand`
 *   - local_docker → `docker exec <container> bash -c …` (via DOCKER_HOST)
 *
 * NOTE on Windows local dev: `docker exec` stdout can come back empty through the
 * TCP→pipe relay, but the command's SIDE EFFECTS still apply (exit code 0). On a
 * real Linux Docker host (the VPS) stdout is captured normally.
 */
import { execSync } from 'node:child_process';
import { eq } from 'drizzle-orm';
import { sandboxes } from '@kortix/db';
import { db } from '../../shared/db';
import { config } from '../../config';
import { DOCKER_EXEC_SHELL } from '../../shared/exec-shell';
import { getDaytona } from '../../shared/daytona';

export interface SandboxExecResult {
  exitCode: number;
  output: string;
}

/** Single-quote a value for safe embedding in a `bash -c` command. */
function shq(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Read the sandbox's provider from the DB (defaults to daytona). */
export async function getSandboxProviderName(externalId: string): Promise<string> {
  try {
    const [row] = await db
      .select({ provider: sandboxes.provider })
      .from(sandboxes)
      .where(eq(sandboxes.externalId, externalId))
      .limit(1);
    return row?.provider ?? 'daytona';
  } catch {
    return 'daytona';
  }
}

/**
 * Run a command inside a sandbox, PROVIDER-AGNOSTIC. Returns exit code + output.
 * `env` vars are passed to the command's environment.
 */
export async function execInSandbox(
  externalId: string,
  cmd: string,
  env: Record<string, string>,
  timeoutSec: number,
): Promise<SandboxExecResult> {
  const provider = await getSandboxProviderName(externalId);

  if (provider === 'local_docker') {
    const dockerEnv: NodeJS.ProcessEnv = { ...process.env };
    if (config.DOCKER_HOST && !config.DOCKER_HOST.includes('://')) {
      dockerEnv.DOCKER_HOST = `unix://${config.DOCKER_HOST}`;
    }
    const envFlags = Object.entries(env)
      .map(([k, v]) => `-e ${shq(`${k}=${v}`)}`)
      .join(' ');
    const container = config.SANDBOX_CONTAINER_NAME || 'kortix-sandbox';
    const full = `docker exec ${envFlags} ${shq(container)} bash -c ${shq(cmd)}`;
    try {
      const out = execSync(full, {
        timeout: timeoutSec * 1000,
        stdio: 'pipe',
        env: dockerEnv,
        shell: DOCKER_EXEC_SHELL,
      }).toString();
      return { exitCode: 0, output: out };
    } catch (e: any) {
      const out = `${e?.stdout?.toString?.() ?? ''}${e?.stderr?.toString?.() ?? ''}`.trim();
      return { exitCode: typeof e?.status === 'number' ? e.status : 1, output: out || (e?.message ?? '') };
    }
  }

  // daytona (default)
  const sandbox = await getDaytona().get(externalId);
  const res = await sandbox.process.executeCommand(cmd, undefined, env, timeoutSec);
  return { exitCode: res.exitCode, output: res.result ?? '' };
}
