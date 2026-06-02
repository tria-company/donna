'use client';

import React, { useState } from 'react';
import { useAdminRole } from '@/hooks/admin/use-admin-role';
import {
  useAccessStatus,
  useAllowlist,
  useAddAllowlistEmail,
  useRemoveAllowlistEntry,
  useAdminAccessRequests,
  useApproveAccessRequest,
  useRejectAccessRequest,
} from '@/hooks/admin/use-access-control';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/lib/toast';
import { Trash2, Check, X, ShieldCheck, Lock, Unlock } from 'lucide-react';

export default function AdminAccessPage() {
  const { data: roleData, isLoading: roleLoading } = useAdminRole();
  const isAdmin = roleData?.isAdmin;

  const { data: status } = useAccessStatus();
  const { data: allowlist } = useAllowlist();
  const { data: requests } = useAdminAccessRequests('pending');
  const addEmail = useAddAllowlistEmail();
  const removeEntry = useRemoveAllowlistEntry();
  const approve = useApproveAccessRequest();
  const reject = useRejectAccessRequest();

  const [email, setEmail] = useState('');

  if (!roleLoading && !isAdmin) {
    return (
      <div className="flex h-full items-center justify-center text-center">
        <div>
          <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">Acesso restrito a administradores.</p>
        </div>
      </div>
    );
  }

  const handleAdd = async () => {
    const value = email.trim().toLowerCase();
    if (!value || !value.includes('@')) {
      toast.warning('Informe um email válido');
      return;
    }
    try {
      await addEmail.mutateAsync({ value, entryType: 'email' });
      toast.success(`Acesso liberado para ${value}`);
      setEmail('');
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao adicionar email');
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 overflow-y-auto px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-primary">Acesso de usuários</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Libere o acesso cadastrando o email. Só emails na lista conseguem entrar.
        </p>
      </div>

      {/* Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {status?.signupsEnabled ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4 text-primary" />}
            {status?.signupsEnabled ? 'Cadastro aberto a todos' : 'Modo convite (invite-only)'}
          </CardTitle>
          <CardDescription>
            {status?.signupsEnabled
              ? 'Qualquer um pode se cadastrar. Para restringir, defina SIGNUPS_ENABLED=false na API.'
              : `Apenas emails liberados podem entrar. ${status?.allowlistCount ?? 0} liberado(s).`}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Add email */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Liberar acesso por email</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="email@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <Button onClick={handleAdd} disabled={addEmail.isPending}>
              {addEmail.isPending ? 'Adicionando…' : 'Liberar'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pending requests */}
      {!!requests?.requests?.length && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pedidos de acesso</CardTitle>
            <CardDescription>Usuários que solicitaram acesso.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {requests.requests.map((r) => (
              <div key={r.id} className="flex items-center gap-2 rounded-lg border border-border p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.email}</div>
                  {r.company && <div className="truncate text-xs text-muted-foreground">{r.company}</div>}
                </div>
                <Button size="sm" variant="secondary" onClick={() => approve.mutate(r.id)} disabled={approve.isPending}>
                  <Check className="h-4 w-4" /> Aprovar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => reject.mutate(r.id)} disabled={reject.isPending}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Allowlist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Emails liberados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!allowlist?.entries?.length && (
            <p className="py-4 text-center text-sm text-muted-foreground">Nenhum email liberado ainda.</p>
          )}
          {allowlist?.entries?.map((entry) => (
            <div key={entry.id} className="flex items-center gap-2 rounded-lg border border-border p-3">
              <span className="min-w-0 flex-1 truncate text-sm">{entry.value}</span>
              {entry.entryType === 'domain' && <Badge variant="secondary">domínio</Badge>}
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => removeEntry.mutate(entry.id)}
                disabled={removeEntry.isPending}
                aria-label="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
