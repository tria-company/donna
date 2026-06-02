'use client';

import { useQuery } from '@tanstack/react-query';
import { backendApi } from '@/lib/api-client';
import { useAuth } from '@/components/AuthProvider';

export interface BrowseFile {
  doc_id: string;
  title: string;
  source: string | null;
  status: string;
  chunk_count: number;
  error: string | null;
  agents: string[];
}
export interface BrowseResult {
  folders: { name: string; count: number }[];
  files: BrowseFile[];
}

/** Lazily list one folder level (subfolders + files of `folder`). */
export function useKnowledgeBrowse(folder: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['knowledge', 'browse', folder],
    queryFn: async (): Promise<BrowseResult> => {
      const qs = folder ? `?folder=${encodeURIComponent(folder)}` : '';
      const res = await backendApi.get<BrowseResult>(`/knowledge/browse${qs}`, { showErrors: false });
      return res.data ?? { folders: [], files: [] };
    },
    enabled: !!user,
    staleTime: 5_000,
    refetchInterval: (q) => {
      const d = q.state.data as BrowseResult | undefined;
      return d?.files?.some((f) => f.status === 'processing' || f.status === 'pending') ? 3000 : false;
    },
  });
}

export async function uploadKnowledgeDoc(file: File, folder?: string): Promise<{ doc_id: string; status: string; chunk_count: number }> {
  const fd = new FormData();
  fd.append('file', file);
  if (folder) fd.append('folder', folder);
  const res = await backendApi.upload<{ doc_id: string; status: string; chunk_count: number }>(
    '/knowledge/documents',
    fd,
    { timeout: 180_000, showErrors: false },
  );
  if (res.error) throw new Error(res.error.message || 'Falha no upload');
  return res.data!;
}

export async function deleteKnowledgeDoc(docId: string): Promise<void> {
  const res = await backendApi.delete(`/knowledge/documents/${docId}`, { showErrors: false });
  if (res.error) throw new Error(res.error.message || 'Falha ao excluir');
}

/** Move a document to a new full source path (folder reorganization). */
export async function moveKnowledgeDoc(docId: string, source: string): Promise<void> {
  const res = await backendApi.post(`/knowledge/documents/${encodeURIComponent(docId)}/move`, { source }, { showErrors: false });
  if (res.error) throw new Error(res.error.message || 'Falha ao mover');
}

// ── Per-document × per-agent access ──────────────────────────────────────────

/** Replace the set of agents that can access a document. */
export async function setKnowledgeDocAccess(docId: string, agents: string[]): Promise<void> {
  const res = await backendApi.post(`/knowledge/documents/${encodeURIComponent(docId)}/access`, { agents }, { showErrors: false });
  if (res.error) throw new Error(res.error.message || 'Falha ao atualizar acesso do documento');
}
