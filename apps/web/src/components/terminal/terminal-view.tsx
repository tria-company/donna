'use client';

import { useServerStore } from '@/stores/server-store';
import { SSHTerminal } from '@/components/thread/donna-computer/components/SSHTerminal';

/**
 * Standalone Terminal tab (/terminal). Opens a real shell in the account's
 * active sandbox via the Daytona PTY bridge (ws /v1/sandboxes/:id/terminal/ws).
 * SSHTerminal handles auth + the WebSocket; we just hand it the sandbox id.
 */
export function TerminalView() {
  const sandboxId = useServerStore((s) => {
    const entry = s.servers.find((srv) => srv.id === s.activeServerId);
    return entry?.instanceId || entry?.sandboxId || '';
  });

  if (!sandboxId) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
        Nenhum computador ativo. Inicie uma sessão para provisionar o sandbox e abrir o terminal.
      </div>
    );
  }

  return (
    <div className="h-full w-full p-3">
      <SSHTerminal sandboxId={sandboxId} className="h-full rounded-xl border border-border/50" />
    </div>
  );
}
