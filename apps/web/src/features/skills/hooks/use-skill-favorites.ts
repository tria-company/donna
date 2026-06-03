'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backendApi } from '@/lib/api-client';
import { useAuth } from '@/components/AuthProvider';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const skillFavoritesKeys = {
  all: ['kortix', 'skill-favorites'] as const,
};

// ---------------------------------------------------------------------------
// Read — favorited skill names as a Set
// ---------------------------------------------------------------------------

export function useSkillFavorites() {
  const { user, isLoading: isAuthLoading } = useAuth();
  return useQuery<Set<string>>({
    queryKey: [...skillFavoritesKeys.all, user?.id ?? 'anonymous'],
    queryFn: async (): Promise<Set<string>> => {
      const r = await backendApi.get<{ favorites: string[] }>('/skill-favorites', { showErrors: false });
      if (r.error) throw new Error(r.error.message);
      return new Set<string>(r.data?.favorites ?? []);
    },
    enabled: !isAuthLoading && !!user,
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
  const key = [...skillFavoritesKeys.all, user?.id ?? 'anonymous'];

  return useMutation<void, Error, { name: string; favorite: boolean }, { previous?: Set<string> }>({
    mutationFn: async ({ name, favorite }) => {
      const r = favorite
        ? await backendApi.post('/skill-favorites', { name })
        : await backendApi.delete(`/skill-favorites/${encodeURIComponent(name)}`);
      if (r.error) throw new Error(r.error.message);
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
