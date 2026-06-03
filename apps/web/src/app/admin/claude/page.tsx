"use client";

import { useState } from "react";
import { Bot, ExternalLink, Check, AlertTriangle, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DonnaLoader } from "@/components/ui/donna-loader";
import { toast } from "@/lib/toast";
import {
  useAnthropicOAuthStatus,
  useStartAnthropicOAuth,
  useCompleteAnthropicOAuth,
  useDisconnectAnthropicOAuth,
} from "@/hooks/admin/use-anthropic-oauth";

export default function AdminClaudePage() {
  const { data: status, isLoading } = useAnthropicOAuthStatus();
  const start = useStartAnthropicOAuth();
  const complete = useCompleteAnthropicOAuth();
  const disconnect = useDisconnectAnthropicOAuth();

  const [awaitingCode, setAwaitingCode] = useState(false);
  const [code, setCode] = useState("");

  const handleConnect = async () => {
    try {
      const { url } = await start.mutateAsync();
      window.open(url, "_blank", "noopener,noreferrer");
      setAwaitingCode(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao iniciar a conexão");
    }
  };

  const handleComplete = async () => {
    if (!code.trim()) {
      toast.error("Cole a URL de redirect (ou o código).");
      return;
    }
    try {
      await complete.mutateAsync(code.trim());
      toast.success("Claude Pro/Max conectado!");
      setCode("");
      setAwaitingCode(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao concluir a conexão");
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Desconectar a assinatura Claude? Os agentes pararão de usar a conta.")) return;
    try {
      await disconnect.mutateAsync();
      toast.success("Assinatura desconectada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao desconectar");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <DonnaLoader size="large" />
      </div>
    );
  }

  const connected = !!status?.connected;

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-none">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-semibold tracking-tight">Claude Pro/Max</h1>
              <p className="text-sm text-muted-foreground">
                Conecte uma assinatura Claude (OAuth, sem API key) para alimentar os agentes de toda a instância.
              </p>
            </div>
            {connected ? (
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 border">Conectado</Badge>
            ) : (
              <Badge variant="secondary">Desconectado</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 pb-6 space-y-6">
          {/* Aviso */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-none" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p>É <strong>uma</strong> assinatura para a instância inteira — todos os usuários dividem o limite semanal da Anthropic.</p>
              <p>Usar uma assinatura pessoal num produto pode violar os termos da Anthropic. O refresh token fica só no backend; os sandboxes nunca o veem.</p>
            </div>
          </div>

          {/* Estado conectado */}
          {connected && (
            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Check className="w-4 h-4 text-emerald-500" />
                Assinatura conectada
              </div>
              {status?.expiresAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  Token de acesso expira em {new Date(status.expiresAt).toLocaleString()} (renovado automaticamente).
                </p>
              )}
              {status?.updatedAt && (
                <p className="text-xs text-muted-foreground">
                  Conectado em {new Date(status.updatedAt).toLocaleString()}.
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={handleDisconnect}
                disabled={disconnect.isPending}
              >
                <Unplug className="w-3.5 h-3.5 mr-1.5" />
                Desconectar
              </Button>
            </div>
          )}

          {/* Fluxo de conexão */}
          {!connected && (
            <div className="rounded-xl border p-4 space-y-4">
              {!awaitingCode ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Clique para abrir o login do Claude numa aba nova. Depois de entrar, você copia a URL de redirect e cola aqui.
                  </p>
                  <Button onClick={handleConnect} disabled={start.isPending}>
                    <ExternalLink className="w-4 h-4 mr-1.5" />
                    {start.isPending ? "Abrindo…" : "Conectar Claude Pro/Max"}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Fez login na aba que abriu? Copie a <strong>URL de redirect</strong> (começa com <code className="text-xs">http://localhost</code>) e cole abaixo:
                  </p>
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Cole a URL de redirect (ou o código)"
                    onKeyDown={(e) => e.key === "Enter" && handleComplete()}
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleComplete} disabled={complete.isPending}>
                      {complete.isPending ? "Concluindo…" : "Concluir conexão"}
                    </Button>
                    <Button variant="ghost" onClick={() => { setAwaitingCode(false); setCode(""); }}>
                      Cancelar
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
