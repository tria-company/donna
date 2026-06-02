/**
 * MCP injection — wire a Composio MCP server into the sandbox's opencode config.
 *
 * Composio exposes each connected app as a remote MCP server URL. We add it to
 * the `mcp` map in the sandbox's workspace config (/workspace/.opencode/opencode.jsonc)
 * and hot-reload OpenCode, so the agent immediately gains the toolkit's tools.
 *
 * Edits are done in-sandbox via the Daytona SDK (same mechanism used to repair
 * the config), with a JSONC-safe parser (string-aware → never corrupts URLs)
 * and owner preservation (opencode runs as `abc`).
 */
import { getDaytona } from '../../shared/daytona';
import { db } from '../../shared/db';
import { sandboxes } from '@kortix/db';
import { and, eq } from 'drizzle-orm';

export interface McpServerEntry {
  name: string;
  url: string;
  enabled?: boolean;
  headers?: Record<string, string>;
}

// Static Python — reads MCP_ADD / MCP_REMOVE from env (JSON), merges into the
// workspace opencode.jsonc `mcp` map, writes valid JSON, preserves owner.
const PY = `
import json, re, os, sys, base64
P = "/workspace/.opencode/opencode.jsonc"
def _envjson(k):
    v = os.environ.get(k)
    if not v: return []
    try: return json.loads(base64.b64decode(v).decode())
    except Exception: return []
ADD = _envjson("MCP_ADD_B64")
REMOVE = _envjson("MCP_REMOVE_B64")

def strip_jsonc(s):
    out = []; i = 0; n = len(s); ins = False; esc = False
    while i < n:
        c = s[i]
        if ins:
            out.append(c)
            if esc: esc = False
            elif c == chr(92): esc = True
            elif c == '"': ins = False
            i += 1; continue
        if c == '"': ins = True; out.append(c); i += 1; continue
        if c == '/' and i + 1 < n and s[i+1] == '/':
            while i < n and s[i] != chr(10): i += 1
            continue
        if c == '/' and i + 1 < n and s[i+1] == '*':
            i += 2
            while i + 1 < n and not (s[i] == '*' and s[i+1] == '/'): i += 1
            i += 2; continue
        out.append(c); i += 1
    r = ''.join(out)
    r = re.sub(r',(\\s*[}\\]])', r'\\1', r)
    return r

cfg = {}; uid = gid = None
if os.path.exists(P):
    st = os.stat(P); uid, gid = st.st_uid, st.st_gid
    raw = open(P).read().strip()
    if raw:
        try:
            cfg = json.loads(strip_jsonc(raw))
        except Exception as e:
            print("PARSE_FAIL:" + str(e)); sys.exit(2)
if not isinstance(cfg, dict): cfg = {}
mcp = cfg.get("mcp")
if not isinstance(mcp, dict): mcp = {}
for name in REMOVE:
    mcp.pop(name, None)
for e in ADD:
    entry = {"type": "remote", "url": e["url"], "enabled": e.get("enabled", True)}
    if e.get("headers"): entry["headers"] = e["headers"]
    mcp[e["name"]] = entry
cfg["mcp"] = mcp
cfg.setdefault("$schema", "https://opencode.ai/config.json")
open(P, "w").write(json.dumps(cfg, indent=2) + "\\n")
if uid is not None:
    try: os.chown(P, uid, gid)
    except Exception as ex: print("chown_warn:" + str(ex))
print("OK mcp=" + ",".join(sorted(mcp.keys())))
`;
const PY_B64 = Buffer.from(PY, 'utf8').toString('base64');

export interface ApplyMcpResult {
  ok: boolean;
  output: string;
  reloaded: boolean;
}

/**
 * Add and/or remove MCP servers in a sandbox's opencode config, then hot-reload.
 * `externalId` is the Daytona sandbox id.
 */
export async function applyMcpToSandbox(
  externalId: string,
  opts: { add?: McpServerEntry[]; remove?: string[] },
): Promise<ApplyMcpResult> {
  const sandbox = await getDaytona().get(externalId);
  const env = {
    MCP_ADD_B64: Buffer.from(JSON.stringify(opts.add ?? []), 'utf8').toString('base64'),
    MCP_REMOVE_B64: Buffer.from(JSON.stringify(opts.remove ?? []), 'utf8').toString('base64'),
  };
  const res = await sandbox.process.executeCommand(
    `echo ${PY_B64} | base64 -d | python3 -`,
    undefined,
    env,
    30,
  );
  const ok = res.exitCode === 0;

  let reloaded = false;
  if (ok) {
    try {
      const reload = await sandbox.process.executeCommand(
        `curl -s -m 25 -o /dev/null -w '%{http_code}' -X POST http://localhost:4096/instance/dispose`,
        undefined,
        undefined,
        30,
      );
      reloaded = (reload.result ?? '').includes('200');
    } catch {
      // reload best-effort — config is on disk; next session start picks it up
    }
  }

  return { ok, output: (res.result ?? '').trim(), reloaded };
}

/** Resolve the Daytona externalId of the account's active sandbox (or null). */
export async function getAccountSandboxExternalId(accountId: string): Promise<string | null> {
  const [row] = await db
    .select({ externalId: sandboxes.externalId })
    .from(sandboxes)
    .where(and(eq(sandboxes.accountId, accountId), eq(sandboxes.status, 'active')))
    .limit(1);
  return row?.externalId || null;
}
