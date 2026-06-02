'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Check, Plug, Search } from 'lucide-react';

import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import {
  useComposioToolkits,
  useComposioConnections,
  connectComposioToolkit,
  waitForConnectionActive,
  enableComposioConnection,
  isConnectionActive,
  connectionToolkitSlug,
  type ComposioToolkit,
} from '@/hooks/donna/use-composio';

export function ComposioConnectors() {
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: toolkits = [], isLoading } = useComposioToolkits(search.trim() || undefined);
  const { data: connections = [] } = useComposioConnections();

  const connectedSlugs = useMemo(() => {
    const s = new Set<string>();
    for (const c of connections) {
      if (isConnectionActive(c)) {
        const slug = connectionToolkitSlug(c);
        if (slug) s.add(slug.toLowerCase());
      }
    }
    return s;
  }, [connections]);

  async function handleConnect(tk: ComposioToolkit) {
    const id = `composio-${tk.slug}`;
    setBusy(tk.slug);
    try {
      toast.loading(`Conectando ${tk.name}…`, { id });
      const { connectedAccountId, authConfigId, redirectUrl } = await connectComposioToolkit(tk.slug);

      if (redirectUrl) {
        window.open(redirectUrl, '_blank', 'noopener,noreferrer,width=620,height=820');
        toast.loading(`Autorize ${tk.name} na janela aberta…`, { id });
        const ok = await waitForConnectionActive(connectedAccountId);
        if (!ok) {
          toast.error(`Tempo esgotado aguardando a autorização de ${tk.name}.`, { id });
          return;
        }
      }

      toast.loading(`Ativando ${tk.name} no agente…`, { id });
      const res = await enableComposioConnection(connectedAccountId, tk.slug, authConfigId);
      if (res.success) {
        toast.success(
          res.injected
            ? `${tk.name} conectado — as ferramentas já estão no agente.`
            : `${tk.name} conectado (será aplicado quando o sandbox estiver ativo).`,
          { id },
        );
      } else {
        toast.error(`Não foi possível ativar ${tk.name}.`, { id });
      }
      queryClient.invalidateQueries({ queryKey: ['composio', 'connections'] });
    } catch (err) {
      toast.error(`Falha ao conectar ${tk.name}: ${err instanceof Error ? err.message : String(err)}`, { id });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative mx-auto max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar apps (Gmail, Slack, GitHub…)"
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : toolkits.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nenhum app encontrado.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {toolkits.map((tk) => {
            const connected = connectedSlugs.has(tk.slug.toLowerCase());
            const isBusy = busy === tk.slug;
            return (
              <Card key={tk.slug} className="group min-w-0 transition-colors hover:border-primary/40">
                <CardHeader>
                  <div className="flex min-w-0 items-center gap-3">
                    {tk.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={tk.logo}
                        alt={tk.name}
                        className="h-8 w-8 flex-shrink-0 rounded-md bg-white/5 object-contain"
                      />
                    ) : (
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-muted">
                        <Plug className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <CardTitle className="min-w-0 flex-1 truncate text-base">{tk.name}</CardTitle>
                    {connected && (
                      <Badge variant="secondary" className="shrink-0 gap-1 text-primary">
                        <Check className="h-3 w-3" /> Conectado
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-2 min-h-[2.5rem] break-words text-sm text-muted-foreground">
                    {tk.description || '—'}
                  </p>
                </CardContent>
                <CardFooter className="gap-2">
                  {tk.toolsCount ? (
                    <span className="text-xs text-muted-foreground">{tk.toolsCount} ferramentas</span>
                  ) : (
                    <span />
                  )}
                  <Button
                    size="sm"
                    variant={connected ? 'outline' : 'default'}
                    className="ml-auto"
                    disabled={isBusy}
                    onClick={() => handleConnect(tk)}
                  >
                    {isBusy ? (
                      <Loader2 className={cn('h-3.5 w-3.5 animate-spin')} />
                    ) : connected ? (
                      'Reconectar'
                    ) : (
                      'Conectar'
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
