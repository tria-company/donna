import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backendApi } from '@/lib/api-client';
import { useAuth } from '@/components/AuthProvider';

export interface AnthropicOAuthStatus {
  connected: boolean;
  expiresAt: string | null;
  updatedAt: string | null;
}

const KEY = ['admin', 'anthropic-oauth'];

/** Status da assinatura Claude Pro/Max conectada (instância inteira). */
export function useAnthropicOAuthStatus() {
  const { user } = useAuth();
  return useQuery<AnthropicOAuthStatus>({
    queryKey: [...KEY, 'status'],
    queryFn: async () => {
      const r = await backendApi.get<AnthropicOAuthStatus>('/admin/api/anthropic-oauth/status', { showErrors: false });
      if (r.error) throw new Error(r.error.message);
      return r.data!;
    },
    enabled: !!user,
    staleTime: 10_000,
  });
}

/** Inicia o fluxo OAuth — devolve a URL de login do claude.ai. */
export function useStartAnthropicOAuth() {
  return useMutation({
    mutationFn: async () => {
      const r = await backendApi.post<{ url: string }>('/admin/api/anthropic-oauth/start', {});
      if (r.error) throw new Error(r.error.message);
      return r.data!;
    },
  });
}

/** Conclui o fluxo — recebe a URL de redirect (ou o código) colada pelo admin. */
export function useCompleteAnthropicOAuth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const r = await backendApi.post<{ ok: boolean; error?: string }>('/admin/api/anthropic-oauth/complete', { code }, { showErrors: false });
      if (r.error) throw new Error(r.error.message);
      if (!r.data?.ok) throw new Error(r.data?.error || 'Falha ao concluir a conexão');
      return r.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Desconecta a assinatura (apaga a credencial central). */
export function useDisconnectAnthropicOAuth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const r = await backendApi.post('/admin/api/anthropic-oauth/disconnect', {});
      if (r.error) throw new Error(r.error.message);
      return r.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
