/**
 * Terminal ↔ Daytona PTY bridge.
 *
 * The frontend SSHTerminal opens ws://…/v1/sandboxes/:id/terminal/ws, sends
 * `{type:'auth', access_token}` first, then `{type:'input'|'resize'}`. We
 * validate the Supabase token, resolve the account's sandbox, open a real shell
 * via the Daytona PTY (sandbox.process.createPty) and bridge it both ways.
 *
 * Messages to the client: {type:'status'|'connected'|'output'|'error'|'exit'}.
 */
import { verifySupabaseJwt } from '../shared/jwt-verify';
import { getDaytona } from '../shared/daytona';
import { resolveAccountId } from '../shared/resolve-account';
import { db } from '../shared/db';
import { sandboxes } from '@kortix/db';
import { eq, or } from 'drizzle-orm';

export interface TerminalWsData {
  type: 'terminal-pty';
  sandboxId: string;
  authed: boolean;
  pty: any | null;
  closed: boolean;
}

interface WsLike {
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
  data: any;
}

let ptyCounter = 0;

function send(ws: WsLike, obj: Record<string, unknown>): void {
  try {
    ws.send(JSON.stringify(obj));
  } catch {
    /* socket already gone */
  }
}

export function isTerminalWs(data: unknown): data is TerminalWsData {
  return !!data && typeof data === 'object' && (data as { type?: string }).type === 'terminal-pty';
}

async function resolveOwnedExternalId(sandboxId: string, accountId: string): Promise<string | null> {
  const [row] = await db
    .select({ externalId: sandboxes.externalId, accountId: sandboxes.accountId })
    .from(sandboxes)
    .where(or(eq(sandboxes.sandboxId, sandboxId), eq(sandboxes.externalId, sandboxId)))
    .limit(1);
  if (!row || row.accountId !== accountId) return null;
  return row.externalId || null;
}

export async function onTerminalMessage(ws: WsLike, raw: string | Buffer): Promise<void> {
  const data = ws.data as TerminalWsData;
  if (data.closed) return;

  let msg: any;
  try {
    msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf8'));
  } catch {
    return;
  }

  // ── First message authenticates; then we open the PTY ──────────────────────
  if (!data.authed) {
    if (msg?.type !== 'auth' || !msg.access_token) {
      send(ws, { type: 'error', message: 'Authentication required' });
      return;
    }
    const v = await verifySupabaseJwt(String(msg.access_token));
    if (!v.ok) {
      send(ws, { type: 'error', message: 'Invalid or expired token' });
      ws.close();
      return;
    }
    data.authed = true;

    let externalId: string | null = null;
    try {
      const accountId = await resolveAccountId(v.userId);
      externalId = await resolveOwnedExternalId(data.sandboxId, accountId);
    } catch {
      externalId = null;
    }
    if (!externalId) {
      send(ws, { type: 'error', message: 'Sandbox not found or not accessible' });
      ws.close();
      return;
    }

    send(ws, { type: 'status', message: 'Abrindo shell no sandbox…' });
    try {
      const sandbox = await getDaytona().get(externalId);
      ptyCounter += 1;
      const pty = await sandbox.process.createPty({
        id: `donna-term-${Date.now()}-${ptyCounter}`,
        cwd: '/workspace',
        cols: 120,
        rows: 30,
        onData: (bytes: Uint8Array) => {
          if (data.closed) return;
          send(ws, { type: 'output', data: new TextDecoder().decode(bytes) });
        },
      });
      data.pty = pty;
      await pty.waitForConnection();
      if (data.closed) {
        try { await pty.disconnect(); } catch { /* noop */ }
        return;
      }
      send(ws, { type: 'connected', message: 'Conectado ao sandbox' });

      // Notify the client when the shell exits.
      pty
        .wait()
        .then((res: { exitCode?: number }) => {
          if (!data.closed) send(ws, { type: 'exit', code: res.exitCode ?? 0 });
        })
        .catch(() => {});
    } catch (err) {
      send(ws, { type: 'error', message: `Falha ao abrir o terminal: ${err instanceof Error ? err.message : String(err)}` });
      ws.close();
    }
    return;
  }

  // ── Authed: forward keystrokes / resize to the PTY ─────────────────────────
  if (!data.pty) return;
  try {
    if (msg?.type === 'input' && typeof msg.data === 'string') {
      await data.pty.sendInput(msg.data);
    } else if (msg?.type === 'resize' && Number(msg.cols) > 0 && Number(msg.rows) > 0) {
      await data.pty.resize(Number(msg.cols), Number(msg.rows));
    }
  } catch {
    /* transient send/resize error — ignore */
  }
}

export async function onTerminalClose(ws: WsLike): Promise<void> {
  const data = ws.data as TerminalWsData;
  if (!isTerminalWs(data)) return;
  data.closed = true;
  try {
    await data.pty?.disconnect();
  } catch {
    /* already gone */
  }
  data.pty = null;
}
