'use client';

import { useQuery } from '@tanstack/react-query';
import { backendApi } from '@/lib/api-client';
import { useAuth } from '@/components/AuthProvider';

export interface ComposioToolkit {
  slug: string;
  name: string;
  description: string | null;
  logo: string | null;
  categories: string[];
  authSchemes: string[];
  noAuth: boolean;
  toolsCount: number | null;
}

export interface ComposioConnection {
  id: string;
  status?: string;
  toolkit?: { slug?: string } | string | null;
  // Composio's connected_account shape varies across fields — keep it loose.
  [k: string]: unknown;
}

/** Connection status helpers (Composio uses ACTIVE / INITIATED / INITIALIZING / FAILED). */
export function isConnectionActive(conn: ComposioConnection): boolean {
  return String(conn.status ?? '').toUpperCase() === 'ACTIVE';
}

export function connectionToolkitSlug(conn: ComposioConnection): string | null {
  const t = conn.toolkit;
  if (typeof t === 'string') return t;
  if (t && typeof t === 'object' && typeof t.slug === 'string') return t.slug;
  const flat = (conn as Record<string, unknown>).toolkit_slug ?? (conn as Record<string, unknown>).app;
  return typeof flat === 'string' ? flat : null;
}

export function useComposioToolkits(search?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['composio', 'toolkits', search ?? ''],
    queryFn: async (): Promise<ComposioToolkit[]> => {
      const qs = new URLSearchParams();
      if (search) qs.set('q', search);
      qs.set('limit', '60');
      const res = await backendApi.get<{ items: ComposioToolkit[] }>(
        `/composio/toolkits?${qs.toString()}`,
        { showErrors: false },
      );
      return res.data?.items ?? [];
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });
}

export function useComposioConnections() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['composio', 'connections'],
    queryFn: async (): Promise<ComposioConnection[]> => {
      const res = await backendApi.get<{ items: ComposioConnection[] }>(`/composio/connections`, {
        showErrors: false,
      });
      return res.data?.items ?? [];
    },
    enabled: !!user,
    staleTime: 30_000,
  });
}

export interface ConnectResult {
  connectedAccountId: string;
  authConfigId: string;
  redirectUrl: string | null;
  status: string;
}

/** Start a connection (OAuth) for a toolkit. */
export async function connectComposioToolkit(slug: string): Promise<ConnectResult> {
  const res = await backendApi.post<{
    connected_account_id: string;
    auth_config_id: string;
    redirect_url: string | null;
    status: string;
  }>('/composio/connect', { toolkit_slug: slug });
  const d = res.data!;
  return {
    connectedAccountId: d.connected_account_id,
    authConfigId: d.auth_config_id,
    redirectUrl: d.redirect_url,
    status: d.status,
  };
}

/** Poll until the connection becomes ACTIVE (after the user finishes OAuth). */
export async function waitForConnectionActive(
  connectedAccountId: string,
  { timeoutMs = 120_000, intervalMs = 3_000 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    try {
      const res = await backendApi.get<{ items: ComposioConnection[] }>(`/composio/connections`, {
        showErrors: false,
      });
      const match = (res.data?.items ?? []).find((c) => c.id === connectedAccountId);
      if (match && isConnectionActive(match)) return true;
    } catch {
      // keep polling
    }
  }
  return false;
}

/** Create the toolkit's MCP server and inject it into the account's sandbox. */
export async function enableComposioConnection(
  connectedAccountId: string,
  slug: string,
  authConfigId: string,
): Promise<{ success: boolean; injected?: boolean; mcp_url?: string | null }> {
  const res = await backendApi.post<{ success: boolean; injected?: boolean; mcp_url?: string | null }>(
    `/composio/connections/${encodeURIComponent(connectedAccountId)}/enable`,
    { toolkit_slug: slug, auth_config_id: authConfigId },
  );
  return res.data ?? { success: false };
}
