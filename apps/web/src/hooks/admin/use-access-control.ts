import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backendApi } from '@/lib/api-client';
import { useAuth } from '@/components/AuthProvider';

export interface AllowlistEntry {
  id: string;
  entryType: 'email' | 'domain';
  value: string;
  note: string | null;
  createdAt: string;
}

export interface AdminAccessRequest {
  id: string;
  email: string;
  company: string | null;
  useCase: string | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

const KEY = ['admin', 'access-control'];

export function useAccessStatus() {
  const { user } = useAuth();
  return useQuery<{ signupsEnabled: boolean; allowlistCount: number }>({
    queryKey: [...KEY, 'status'],
    queryFn: async () => {
      const r = await backendApi.get<{ signupsEnabled: boolean; allowlistCount: number }>('/access/admin/status', { showErrors: false });
      if (r.error) throw new Error(r.error.message);
      return r.data!;
    },
    enabled: !!user,
    staleTime: 15_000,
  });
}

export function useAllowlist() {
  const { user } = useAuth();
  return useQuery<{ entries: AllowlistEntry[] }>({
    queryKey: [...KEY, 'allowlist'],
    queryFn: async () => {
      const r = await backendApi.get<{ entries: AllowlistEntry[] }>('/access/admin/allowlist', { showErrors: false });
      if (r.error) throw new Error(r.error.message);
      return r.data!;
    },
    enabled: !!user,
    staleTime: 15_000,
  });
}

export function useAddAllowlistEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { value: string; entryType?: 'email' | 'domain'; note?: string }) => {
      const r = await backendApi.post('/access/admin/allowlist', input);
      if (r.error) throw new Error(r.error.message);
      return r.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRemoveAllowlistEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await backendApi.delete(`/access/admin/allowlist/${id}`);
      if (r.error) throw new Error(r.error.message);
      return r.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useAdminAccessRequests(status = 'pending') {
  const { user } = useAuth();
  return useQuery<{ requests: AdminAccessRequest[] }>({
    queryKey: [...KEY, 'requests', status],
    queryFn: async () => {
      const r = await backendApi.get<{ requests: AdminAccessRequest[] }>(`/access/admin/requests?status=${status}`, { showErrors: false });
      if (r.error) throw new Error(r.error.message);
      return r.data!;
    },
    enabled: !!user,
    staleTime: 15_000,
  });
}

export function useApproveAccessRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await backendApi.post(`/access/admin/requests/${id}/approve`);
      if (r.error) throw new Error(r.error.message);
      return r.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRejectAccessRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await backendApi.post(`/access/admin/requests/${id}/reject`);
      if (r.error) throw new Error(r.error.message);
      return r.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
