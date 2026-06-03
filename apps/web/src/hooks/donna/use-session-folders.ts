'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backendApi } from '@/lib/api-client';
import { useAuth } from '@/components/AuthProvider';

export interface SessionFolder {
  id: string;
  name: string;
  position: number;
}
export interface SessionFoldersData {
  folders: SessionFolder[];
  items: Record<string, string>; // sessionId -> folderId
}

const KEY = ['kortix', 'session-folders'];

export function useSessionFolders() {
  const { user, isLoading } = useAuth();
  return useQuery<SessionFoldersData>({
    queryKey: [...KEY, user?.id ?? 'anon'],
    queryFn: async () => {
      const r = await backendApi.get<SessionFoldersData>('/session-folders', { showErrors: false });
      if (r.error) throw new Error(r.error.message);
      return { folders: r.data?.folders ?? [], items: r.data?.items ?? {} };
    },
    enabled: !isLoading && !!user,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: KEY });
}

export function useCreateSessionFolder() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (name: string) => {
      const r = await backendApi.post('/session-folders', { name });
      if (r.error) throw new Error(r.error.message);
    },
    onSuccess: invalidate,
  });
}

export function useRenameSessionFolder() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const r = await backendApi.patch(`/session-folders/${id}`, { name });
      if (r.error) throw new Error(r.error.message);
    },
    onSuccess: invalidate,
  });
}

export function useDeleteSessionFolder() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await backendApi.delete(`/session-folders/${id}`);
      if (r.error) throw new Error(r.error.message);
    },
    onSuccess: invalidate,
  });
}

/** Move uma sessão para uma pasta (folderId null = tira da pasta). */
export function useMoveSessionToFolder() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ sessionId, folderId }: { sessionId: string; folderId: string | null }) => {
      const r = await backendApi.post('/session-folders/items', { sessionId, folderId });
      if (r.error) throw new Error(r.error.message);
    },
    onSuccess: invalidate,
  });
}
