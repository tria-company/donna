'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch } from '@/lib/auth-token';
import { useAuth } from '@/components/AuthProvider';
import { useServerStore } from '@/stores/server-store';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const skillFavoritesKeys = {
  all: ['kortix', 'skill-favorites'] as const,
};

function favoritesUrl(serverUrl: string): string {
  return `${serverUrl.replace(/\/+$/, '')}/v1/skill-favorites`;
}

// ---------------------------------------------------------------------------
// Read — favorited skill names as a Set
// ---------------------------------------------------------------------------

export function useSkillFavorites() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const serverUrl = useServerStore((s) => s.getActiveServerUrl());
  return useQuery<Set<string>>({
    queryKey: [...skillFavoritesKeys.all, user?.id ?? 'anonymous', serverUrl],
    queryFn: async (): Promise<Set<string>> => {
      const res = await authenticatedFetch(favoritesUrl(serverUrl));
      if (!res.ok) throw new Error(`Falha ao carregar favoritos: ${res.status}`);
      const data = await res.json();
      return new Set<string>(data.favorites ?? []);
    },
    enabled: !isAuthLoading && !!user && !!serverUrl,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

// ---------------------------------------------------------------------------
// Toggle — add/remove a favorite (optimistic)
// ---------------------------------------------------------------------------

export function useToggleSkillFavorite() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const serverUrl = useServerStore((s) => s.getActiveServerUrl());
  const key = [...skillFavoritesKeys.all, user?.id ?? 'anonymous', serverUrl];

  return useMutation<void, Error, { name: string; favorite: boolean }, { previous?: Set<string> }>({
    mutationFn: async ({ name, favorite }) => {
      const base = favoritesUrl(serverUrl);
      const res = favorite
        ? await authenticatedFetch(base, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
          })
        : await authenticatedFetch(`${base}/${encodeURIComponent(name)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Falha ao atualizar favorito: ${res.status}`);
    },
    onMutate: async ({ name, favorite }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Set<string>>(key);
      const next = new Set(previous ?? []);
      if (favorite) next.add(name);
      else next.delete(name);
      queryClient.setQueryData(key, next);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: skillFavoritesKeys.all });
    },
  });
}
