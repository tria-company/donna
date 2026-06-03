'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useIsMobile } from '@/hooks/utils';
import { toast } from '@/lib/toast';
import { useSidebar } from '@/components/ui/sidebar';
import {
  useCreateOpenCodeSession,
  useSendOpenCodeMessage,
  useOpenCodeAgents,
  useOpenCodeProviders,
  useOpenCodeCommands,
  useOpenCodeProjects,
  useOpenCodeSkills,
} from '@/hooks/opencode/use-opencode-sessions';
import { useDonnaConnectors } from '@/hooks/donna/use-donna-connectors';
import { ComposioConnectors } from '@/components/dashboard/composio-connectors';
import { useUserHandle } from '@/hooks/donna/use-donna-tickets';
import { getClient } from '@/lib/opencode-sdk';
import { openTabAndNavigate } from '@/stores/tab-store';
import { useServerStore } from '@/stores/server-store';
import { type AttachedFile, SessionChatInput } from '@/components/session/session-chat-input';
import { usePendingFilesStore } from '@/stores/pending-files-store';
import { useOpenCodeLocal, formatModelString } from '@/hooks/opencode/use-opencode-local';
import { useOpenCodeConfig } from '@/hooks/opencode/use-opencode-config';
import { NoInstanceState } from '@/components/dashboard/no-instance-state';
import { useSandbox } from '@/hooks/platform/use-sandbox';
import { DonnaLogo } from '@/components/sidebar/donna-logo';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Menu, Plus } from 'lucide-react';
import type { Command } from '@/hooks/opencode/use-opencode-sessions';
import { playSound } from '@/lib/sounds';
import { cn } from '@/lib/utils';

// ============================================================================
// Dashboard Content — "agent OS" home: hero greeting + command input + the
// catalog of agents/projects/skills/commands/tools/MCPs/connectors as tabs.
// ============================================================================

const SEND_FADE_MS = 150;

interface CatalogItem {
  id: string;
  name: string;
  description?: string;
  badge?: string;
  /** Full instructions / prompt shown in the detail dialog (agents). */
  details?: string;
}

// OpenCode built-in utility subagents — not user-facing, hide them.
const INTERNAL_AGENTS = new Set(['compaction', 'summary', 'title']);

interface TabDef {
  key: string;
  label: string;
  route: string;
  items: CatalogItem[];
  badge?: string;
}

export function DashboardContent() {
  const [isSending, setIsSending] = useState(false);
  const [detail, setDetail] = useState<CatalogItem | null>(null);

  const router = useRouter();
  const isMobile = useIsMobile();
  const { setOpen: setSidebarOpenState, setOpenMobile } = useSidebar();
  const createSession = useCreateOpenCodeSession();
  const sendMessage = useSendOpenCodeMessage();
  const handle = useUserHandle();

  // No-instance fallback: when the user has no sandbox at all, render the
  // claim/onboarding hero in-place instead of bouncing to a dedicated page.
  const { sandbox, isLoading: sandboxLoading } = useSandbox();
  const showNoInstanceState = !sandboxLoading && !sandbox;

  // After Stripe checkout (?subscription=success), refresh sandbox queries.
  const queryClient = useQueryClient();
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('subscription') !== 'success') return;
    queryClient.invalidateQueries({ queryKey: ['platform', 'sandbox'] });
    const clean = new URL(window.location.href);
    clean.searchParams.delete('subscription');
    clean.searchParams.delete('session_id');
    window.history.replaceState({}, '', `${clean.pathname}${clean.search}`);
  }, [queryClient]);

  // Data
  const { data: agents } = useOpenCodeAgents();
  const { data: providers } = useOpenCodeProviders();
  const { data: commands } = useOpenCodeCommands();
  const { data: config } = useOpenCodeConfig();
  const { data: projects } = useOpenCodeProjects();
  const { data: skills } = useOpenCodeSkills();
  const { data: connectors } = useDonnaConnectors();

  // Unified model/agent/variant state
  const local = useOpenCodeLocal({ agents, providers, config });

  const handleSend = useCallback(
    async (text: string, files?: AttachedFile[]) => {
      if ((!text.trim() && !files?.length) || isSending) return;

      playSound('send');
      setIsSending(true);

      try {
        const [session] = await Promise.all([
          createSession.mutateAsync(),
          new Promise<void>((r) => setTimeout(r, SEND_FADE_MS)),
        ]);

        sessionStorage.setItem(`opencode_pending_prompt:${session.id}`, text);

        if (files?.length) {
          usePendingFilesStore.getState().setPendingFiles(files);
        }

        const options: Record<string, unknown> = {};
        if (local.agent.current) options.agent = local.agent.current.name;
        if (local.model.currentKey) options.model = local.model.currentKey;
        if (local.model.variant.current) options.variant = local.model.variant.current;
        if (Object.keys(options).length > 0) {
          sessionStorage.setItem(
            `opencode_pending_options:${session.id}`,
            JSON.stringify(options),
          );
        }

        openTabAndNavigate({
          id: session.id,
          title: 'Nova sessão',
          type: 'session',
          href: `/sessions/${session.id}`,
          serverId: useServerStore.getState().activeServerId,
        });

        requestAnimationFrame(() => {
          window.dispatchEvent(new CustomEvent('focus-session-textarea'));
        });
      } catch {
        usePendingFilesStore.getState().setPendingFiles([]);
        toast.warning('Falha ao criar sessão');
      } finally {
        setIsSending(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isSending, createSession, local.agent.current, local.model.currentKey, local.model.variant.current],
  );

  const handleCommand = useCallback(
    async (cmd: Command, args?: string) => {
      try {
        const session = await createSession.mutateAsync();
        openTabAndNavigate({
          id: session.id,
          title: cmd.name,
          type: 'session',
          href: `/sessions/${session.id}`,
          serverId: useServerStore.getState().activeServerId,
        });
        const client = getClient();
        void client.session.command({
          sessionID: session.id,
          command: cmd.name,
          arguments: args || '',
          ...(local.agent.current && { agent: local.agent.current.name }),
          ...(local.model.currentKey && { model: formatModelString(local.model.currentKey) }),
          ...(local.model.variant.current && { variant: local.model.variant.current }),
        } as any).catch(() => {
          toast.warning('Falha ao executar comando');
        });
      } catch {
        toast.warning('Falha ao criar sessão');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [createSession, local.agent.current, local.model.currentKey, local.model.variant.current],
  );

  // ── Build the catalog tabs from live data ──────────────────────────────
  const tabs = useMemo<TabDef[]>(() => {
    const agentItems: CatalogItem[] = (agents ?? [])
      // Hide subagents (e.g. f1/f2) — they're internal phases the primary agent
      // (mp) invokes via the `task` tool, not agents you talk to directly.
      .filter((a: any) => !INTERNAL_AGENTS.has(a.name) && !a.hidden && a.mode !== 'subagent')
      .map((a: any) => ({
        id: a.name,
        // Donna fork: the default 'general' agent is shown as "Donna" (branding).
        // id stays 'general' so all references/selection keep working.
        name: a.name === 'general' ? 'donna' : a.name,
        description: a.description || '',
        badge: 'Agente',
        details: a.prompt || a.description || '',
      }));
    const projectItems: CatalogItem[] = (projects as any[] ?? []).map((p: any) => {
      const worktreeName = p.worktree ? String(p.worktree).split('/').filter(Boolean).pop() : '';
      return {
        id: String(p.id ?? p.name ?? p.worktree ?? 'projeto'),
        name: String(p.name || worktreeName || 'Projeto'),
        description: String(p.description ?? p.worktree ?? ''),
      };
    });
    const skillItems: CatalogItem[] = (skills as any[] ?? []).map((s: any) => ({
      id: s.name,
      name: s.name,
      description: s.description || '',
    }));
    const connectorItems: CatalogItem[] = (connectors as any[] ?? []).map((c: any) => ({
      id: String(c.id),
      name: String(c.name),
      description: c.description ?? '',
    }));

    return [
      { key: 'agentes', label: 'Agentes', route: '/agents', items: agentItems },
      { key: 'projetos', label: 'Projetos', route: '/projects', items: projectItems },
      { key: 'skills', label: 'Skills', route: '/skills', items: skillItems },
      { key: 'conectores', label: 'Conectores', route: '/connectors', items: connectorItems },
    ];
  }, [agents, projects, skills, connectors]);

  if (showNoInstanceState) {
    return (
      <div className="relative flex flex-col h-full bg-background">
        {isMobile && (
          <div className="absolute left-3 top-1.5 z-10">
            <button
              onClick={() => {
                setSidebarOpenState(true);
                setOpenMobile(true);
              }}
              className="flex items-center justify-center h-9 w-9 -ml-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 active:bg-accent transition-colors touch-manipulation"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        )}
        <NoInstanceState />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full bg-background overflow-y-auto">
      {/* Mobile menu button */}
      {isMobile && (
        <div className="absolute left-3 top-1.5 z-10">
          <button
            onClick={() => {
              setSidebarOpenState(true);
              setOpenMobile(true);
            }}
            className="flex items-center justify-center h-9 w-9 -ml-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 active:bg-accent transition-colors touch-manipulation"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="mx-auto w-full max-w-5xl px-6 py-12 sm:px-4">
        {/* Hero */}
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center justify-center gap-3">
            <DonnaLogo variant="symbol" size={56} />
            <DonnaLogo variant="logomark" size={40} />
          </div>
          <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.22em] text-primary">
            Sistema Operacional de Agentes Autônomos
          </p>
          <h1 className="mt-2 text-4xl font-semibold text-primary sm:text-3xl">
            Olá {handle || 'de volta'}
          </h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Tudo pronto. No que vamos trabalhar hoje?
          </p>
        </div>

        {/* Command input */}
        <div className="mx-auto mt-8 w-full max-w-3xl">
          <SessionChatInput
            onSend={handleSend}
            disabled={isSending}
            placeholder="Use / para executar comandos"
            agents={local.agent.list}
            selectedAgent={local.agent.current?.name ?? null}
            onAgentChange={(name) => local.agent.set(name ?? undefined)}
            models={local.model.list}
            selectedModel={local.model.currentKey ?? null}
            onModelChange={(m) => local.model.set(m ?? undefined, { recent: true })}
            variants={local.model.variant.list}
            selectedVariant={local.model.variant.current ?? null}
            onVariantChange={(v) => local.model.variant.set(v ?? undefined)}
            commands={commands || []}
            onCommand={handleCommand}
          />
        </div>

        {/* Catalog tabs */}
        <Tabs defaultValue="agentes" className="mt-12 w-full">
          <TabsList className="mx-auto flex w-fit max-w-full flex-wrap justify-center">
            {tabs.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {tabs.map((t) => (
            <TabsContent key={t.key} value={t.key} className="mt-6">
              {t.key === 'conectores' ? (
                <ComposioConnectors />
              ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* "New" card for agents */}
                {t.key === 'agentes' && (
                  <Card
                    onClick={() => router.push('/agents')}
                    className="group flex min-w-0 cursor-pointer flex-col items-center justify-center gap-2 border-dashed py-10 text-center transition-colors hover:border-primary/50"
                  >
                    <Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
                    <span className="font-medium">Novo agente</span>
                    <span className="text-xs text-muted-foreground">{t.items.length} ativos</span>
                  </Card>
                )}

                {/* "Manage" card for skills — opens /skills (Minhas Skills + Marketplace) */}
                {t.key === 'skills' && (
                  <Card
                    onClick={() => router.push('/skills')}
                    className="group flex min-w-0 cursor-pointer flex-col items-center justify-center gap-2 border-dashed py-10 text-center transition-colors hover:border-primary/50"
                  >
                    <Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
                    <span className="font-medium">Minhas Skills</span>
                    <span className="text-xs text-muted-foreground">criar, editar, favoritar</span>
                  </Card>
                )}

                {t.items.map((item) => (
                  <Card
                    key={item.id}
                    onClick={() => setDetail(item)}
                    className="group min-w-0 cursor-pointer transition-colors hover:border-primary/40"
                  >
                    <CardHeader>
                      <div className="flex min-w-0 items-center gap-2">
                        <CardTitle className="min-w-0 flex-1 truncate text-base">{item.name}</CardTitle>
                        {item.badge && (
                          <Badge variant="secondary" className="shrink-0">
                            {item.badge}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="line-clamp-2 min-h-[2.5rem] break-words text-sm text-muted-foreground">
                        {item.description || '—'}
                      </p>
                    </CardContent>
                    <CardFooter>
                      <span className="ml-auto text-sm text-muted-foreground group-hover:text-primary">
                        Ver instruções
                      </span>
                    </CardFooter>
                  </Card>
                ))}

                {/* Empty state */}
                {t.items.length === 0 && t.key !== 'agentes' && (
                  <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
                    Nada por aqui ainda.
                  </p>
                )}
              </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Detail dialog — shows the item's full instructions without navigating */}
      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="break-words">{detail?.name}</span>
              {detail?.badge && <Badge variant="secondary">{detail.badge}</Badge>}
            </DialogTitle>
            {detail?.description && (
              <DialogDescription className="break-words">{detail.description}</DialogDescription>
            )}
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] w-full pr-3">
            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground/90">
              {detail?.details?.trim() || detail?.description || 'Sem instruções disponíveis.'}
            </pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
