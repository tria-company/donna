/**
 * Knowledge → sandbox wiring (per-document × per-agent isolation).
 *
 * For each agent that has at least one shared document we inject a dedicated MCP
 * server `kb_<agent>` whose static header `X-Kb-Agent: <agent>` tells the search
 * endpoint which agent is asking (the header comes from the sandbox config, not
 * the model — so it can't be spoofed by a prompt). The endpoint then returns only
 * the documents shared with that agent.
 *
 * Isolation is enforced two ways, both written into /workspace/.opencode/opencode.jsonc:
 *   1. each agent's tool `kb_<agent>_search` is denied globally and allowed only
 *      in that agent's own `agent.<agent>.permission` (so agent B can't call
 *      agent A's tool and harvest A's docs via the header), and
 *   2. the endpoint filters by the header regardless.
 *
 * Same in-sandbox Python mechanism as composio/mcp-inject.ts (JSONC-safe, owner
 * preserving). NOTE: this lives in the volatile workspace config (ocx may reset
 * it) — re-applied on every access change; bake into the snapshot for permanence.
 */
import { getDaytona } from '../shared/daytona';
import { getAccountSandboxExternalId } from '../integrations/composio/mcp-inject';
import { getAgentsWithDocAccess } from './store';

const MCP_URL = '{env:KORTIX_API_URL}/v1/knowledge/mcp';

// Static Python — reads KB_AGENTS_B64 (JSON string[] of agents with doc access)
// and rewrites the knowledge MCP servers + permissions in the workspace config.
const PY = `
import json, re, os, sys, base64
P = "/workspace/.opencode/opencode.jsonc"
MCP_URL = "${MCP_URL}"

def _envjson(k, d):
    v = os.environ.get(k)
    if not v: return d
    try: return json.loads(base64.b64decode(v).decode())
    except Exception: return d
AGENTS = _envjson("KB_AGENTS_B64", [])

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

def is_kb(name): return name == "knowledge" or name.startswith("kb_")
def kb_tool(a): return "kb_" + a + "_search"

# 1. MCP servers: drop all previous knowledge servers, add one per agent.
mcp = cfg.get("mcp")
if not isinstance(mcp, dict): mcp = {}
for k in [k for k in list(mcp.keys()) if is_kb(k)]: mcp.pop(k, None)
for a in AGENTS:
    mcp["kb_" + a] = {
        "type": "remote", "url": MCP_URL, "enabled": True,
        "headers": {"Authorization": "Bearer {env:KORTIX_TOKEN}", "X-Kb-Agent": a},
    }
cfg["mcp"] = mcp

# 2. Global permission: deny every kb tool by default (clean old ones first).
perm = cfg.get("permission")
if not isinstance(perm, dict): perm = {}
perm.pop("knowledge_search", None)
for k in [k for k in list(perm.keys()) if isinstance(k, str) and k.startswith("kb_") and k.endswith("_search")]:
    perm.pop(k, None)
for a in AGENTS: perm[kb_tool(a)] = "deny"
cfg["permission"] = perm

# 3. Per-agent: clear stale kb perms everywhere, then allow each agent its own tool.
agent = cfg.get("agent")
if not isinstance(agent, dict): agent = {}
for name, a_cfg in list(agent.items()):
    if isinstance(a_cfg, dict) and isinstance(a_cfg.get("permission"), dict):
        ap = a_cfg["permission"]
        for k in [k for k in list(ap.keys()) if isinstance(k, str) and k.startswith("kb_") and k.endswith("_search")]:
            ap.pop(k, None)
for a in AGENTS:
    a_cfg = agent.get(a)
    if not isinstance(a_cfg, dict): a_cfg = {}
    ap = a_cfg.get("permission")
    if not isinstance(ap, dict): ap = {}
    ap[kb_tool(a)] = "allow"
    a_cfg["permission"] = ap
    agent[a] = a_cfg
cfg["agent"] = agent

cfg.setdefault("$schema", "https://opencode.ai/config.json")
open(P, "w").write(json.dumps(cfg, indent=2) + "\\n")
if uid is not None:
    try: os.chown(P, uid, gid)
    except Exception as ex: print("chown_warn:" + str(ex))
print("OK kb agents=" + (",".join(sorted(AGENTS)) or "(none)"))
`;
const PY_B64 = Buffer.from(PY, 'utf8').toString('base64');

export interface ApplyKnowledgeResult {
  ok: boolean;
  applied: boolean; // false when the account has no active sandbox
  output: string;
  reloaded: boolean;
}

/**
 * Apply the account's current per-document agent access to its active sandbox.
 * Best-effort: no active sandbox → { applied: false } (DB rows still saved).
 */
export async function applyKnowledgeToSandbox(accountId: string): Promise<ApplyKnowledgeResult> {
  const externalId = await getAccountSandboxExternalId(accountId);
  if (!externalId) return { ok: true, applied: false, output: 'no active sandbox', reloaded: false };

  const agents = await getAgentsWithDocAccess(accountId);
  const sandbox = await getDaytona().get(externalId);
  const env = { KB_AGENTS_B64: Buffer.from(JSON.stringify(agents), 'utf8').toString('base64') };

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
      // best-effort — config is on disk; next session start picks it up
    }
  }

  return { ok, applied: true, output: (res.result ?? '').trim(), reloaded };
}
