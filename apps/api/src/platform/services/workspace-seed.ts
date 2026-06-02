/**
 * Per-account workspace seed — make user-created opencode content durable.
 *
 * User agents/skills/commands live only as files in the sandbox volume
 * (/workspace/.opencode/{agent,command,skills}, plus prompts/ and AGENTS.md).
 * Those are lost when a sandbox is re-provisioned (a new sandbox boots from the
 * shared snapshot with only the baked defaults). This service:
 *
 *   • captureSeed   — tar those paths from the live sandbox → store base64 in DB
 *                     (debounced; skips empty so it never overwrites a good seed)
 *   • restoreSeed   — extract the stored archive into a freshly provisioned
 *                     sandbox, fix ownership (opencode runs as `abc`), reload
 *
 * Everything is best-effort and Daytona-only. All DB/sandbox calls are guarded
 * so a failure (e.g. migration 33 not applied, or sandbox not ready) never
 * breaks sandbox provisioning.
 */
import { and, eq } from 'drizzle-orm';
import { sandboxes } from '@kortix/db';
import { db } from '../../shared/db';
import { getDaytona } from '../../shared/daytona';
import { getSeedMeta, getSeedArchive, upsertSeed } from './workspace-seed-store';

// Paths (relative to /workspace) that make up a user's custom opencode project.
// opencode.jsonc is intentionally excluded — it's volatile (ocx re-serializes it)
// and the MP identity is embedded in the agent bodies, so it carries no state.
const SEED_PATHS = '.opencode/agent .opencode/command .opencode/skills prompts AGENTS.md';
const CAPTURE_MIN_INTERVAL_MS = 5 * 60 * 1000;
const RESTORE_TIMEOUT_MS = 60_000;

interface ActiveSandbox {
  externalId: string;
  provider: string;
}

export async function getActiveSandbox(accountId: string): Promise<ActiveSandbox | null> {
  const [row] = await db
    .select({ externalId: sandboxes.externalId, provider: sandboxes.provider })
    .from(sandboxes)
    .where(and(eq(sandboxes.accountId, accountId), eq(sandboxes.status, 'active')))
    .limit(1);
  if (!row?.externalId) return null;
  return { externalId: row.externalId, provider: row.provider };
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

/**
 * Capture the account's current sandbox opencode project into the DB.
 * Debounced unless `force` — captures at most once per CAPTURE_MIN_INTERVAL_MS.
 * Never stores an empty archive (would clobber a good seed on a not-yet-restored
 * fresh sandbox).
 */
export async function captureSeed(
  accountId: string,
  externalId: string | null,
  provider: string,
  opts: { force?: boolean } = {},
): Promise<{ captured: boolean; fileCount?: number; reason?: string }> {
  if (provider !== 'daytona' || !externalId) return { captured: false, reason: 'unsupported-provider' };
  try {
    if (!opts.force) {
      const meta = await getSeedMeta(accountId);
      if (meta && Date.now() - meta.updatedAt.getTime() < CAPTURE_MIN_INTERVAL_MS) {
        return { captured: false, reason: 'debounced' };
      }
    }
    const sandbox = await getDaytona().get(externalId);
    // Tar only existing paths; print "FILES:n" then the single-line base64.
    const cmd =
      `cd /workspace 2>/dev/null || exit 0; P=""; for d in ${SEED_PATHS}; do [ -e "$d" ] && P="$P $d"; done; ` +
      `if [ -z "$P" ]; then echo "FILES:0"; exit 0; fi; ` +
      `tar czf /tmp/seed.tgz --no-same-owner $P 2>/dev/null && ` +
      `echo "FILES:$(tar tzf /tmp/seed.tgz 2>/dev/null | grep -c '[^/]$')" && base64 -w0 /tmp/seed.tgz; rm -f /tmp/seed.tgz`;
    const res = await sandbox.process.executeCommand(cmd, undefined, undefined, 60);
    const out = (res.result ?? '').trim();
    const m = out.match(/FILES:(\d+)\s*([\s\S]*)$/);
    if (res.exitCode !== 0 || !m) return { captured: false, reason: 'capture-failed' };
    const fileCount = Number(m[1]);
    const b64 = (m[2] || '').trim();
    if (fileCount === 0 || !b64) return { captured: false, reason: 'empty' };
    await upsertSeed(accountId, b64, Math.floor((b64.length * 3) / 4), fileCount);
    console.log(`[workspace-seed] captured account=${accountId} files=${fileCount} b64=${b64.length}b`);
    return { captured: true, fileCount };
  } catch (err) {
    console.warn('[workspace-seed] capture error:', err instanceof Error ? err.message : String(err));
    return { captured: false, reason: 'error' };
  }
}

/** Fire-and-forget debounced capture for the hot path (never awaited/thrown). */
export function maybeCaptureSeed(accountId: string, externalId: string | null, provider: string): void {
  void captureSeed(accountId, externalId, provider).catch(() => {});
}

/**
 * Restore the account's stored seed into a freshly provisioned sandbox.
 * Awaited but fully guarded + time-bounded so it never blocks/breaks provisioning.
 */
export async function restoreSeed(accountId: string, externalId: string | null, provider: string): Promise<boolean> {
  if (provider !== 'daytona' || !externalId) return false;
  try {
    const b64 = await getSeedArchive(accountId);
    if (!b64) return false;
    const buf = Buffer.from(b64, 'base64');
    const sandbox = await getDaytona().get(externalId);
    await withTimeout(sandbox.fs.uploadFile(buf, '/tmp/seed.tgz'), RESTORE_TIMEOUT_MS, 'seed upload');
    const cmd =
      `mkdir -p /workspace/.opencode; tar xzf /tmp/seed.tgz -C /workspace --no-same-owner 2>/dev/null; ` +
      `chown -R abc:abc /workspace/.opencode /workspace/prompts /workspace/AGENTS.md 2>/dev/null || true; ` +
      `rm -f /tmp/seed.tgz; curl -s -m 20 -o /dev/null -X POST http://localhost:4096/instance/dispose || true; echo RESTORED`;
    await withTimeout(
      sandbox.process.executeCommand(cmd, undefined, undefined, 90),
      RESTORE_TIMEOUT_MS,
      'seed extract',
    );
    console.log(`[workspace-seed] restored account=${accountId} into sandbox=${externalId}`);
    return true;
  } catch (err) {
    console.warn('[workspace-seed] restore error:', err instanceof Error ? err.message : String(err));
    return false;
  }
}
