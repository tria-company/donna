'use client';

import { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Upload, Trash2, FileText, Check, AlertCircle, Folder, FolderPlus, ChevronRight, ChevronDown, Users, FolderInput, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { useOpenCodeAgents } from '@/hooks/opencode/use-opencode-sessions';
import {
  useKnowledgeBrowse,
  uploadKnowledgeDoc,
  deleteKnowledgeDoc,
  setKnowledgeDocAccess,
  moveKnowledgeDoc,
  type BrowseFile,
} from '@/hooks/donna/use-knowledge';

const ACCEPT = '.pdf,.txt,.md,.markdown,.csv,.json,.log';
const agentLabel = (n: string) => (n === 'general' ? 'donna' : n);
const fileName = (f: BrowseFile) => (f.source || '').split('/').filter(Boolean).pop() || f.title;

function statusBadge(f: BrowseFile) {
  if (f.status === 'indexed') return <Badge variant="secondary" className="gap-1 text-primary shrink-0"><Check className="h-3 w-3" />{f.chunk_count}</Badge>;
  if (f.status === 'error') return <Badge variant="destructive" className="gap-1 shrink-0"><AlertCircle className="h-3 w-3" /></Badge>;
  return <Badge variant="outline" className="gap-1 shrink-0"><Loader2 className="h-3 w-3 animate-spin" /></Badge>;
}

export function KnowledgeExplorer() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [openDoc, setOpenDoc] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState('');
  const [newFolder, setNewFolder] = useState<string | null>(null);

  const here = path.join('/');
  const { data, isLoading } = useKnowledgeBrowse(here);
  const folders = data?.folders ?? [];
  const files = data?.files ?? [];

  const { data: agents = [] } = useOpenCodeAgents();
  const selectableAgents = useMemo(() => (agents as any[]).filter((a) => a && !a.hidden && a.name), [agents]);

  const refresh = () => qc.invalidateQueries({ queryKey: ['knowledge', 'browse'] });

  // Pastas são derivadas do caminho dos docs (não há "pasta vazia"). "Nova pasta"
  // navega pra dentro da pasta nova; ela passa a existir de fato ao subir um arquivo.
  function createFolder() {
    const name = (newFolder ?? '').replace(/[\\/]/g, '').trim();
    setNewFolder(null);
    if (!name) return;
    setPath([...path, name]);
    setOpenDoc(null);
  }

  async function uploadFiles(list: FileList | File[]) {
    const arr = Array.from(list);
    if (!arr.length) return;
    setUploading(true);
    let ok = 0;
    for (const f of arr) {
      const id = `kb-${f.name}`;
      try {
        toast.loading(`Indexando ${f.name}…`, { id });
        const res = await uploadKnowledgeDoc(f, here || undefined);
        toast.success(`${f.name} (${res.chunk_count} trechos)`, { id });
        ok++;
      } catch (err) {
        toast.error(`${f.name}: ${err instanceof Error ? err.message : String(err)}`, { id });
      }
    }
    setUploading(false);
    if (ok) refresh();
  }

  async function handleDelete(f: BrowseFile) {
    try {
      await deleteKnowledgeDoc(f.doc_id);
      toast.success(`"${fileName(f)}" removido.`);
      refresh();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Falha ao excluir'); }
  }

  async function toggleAgent(f: BrowseFile, agent: string) {
    const cur = f.agents ?? [];
    const next = cur.includes(agent) ? cur.filter((a) => a !== agent) : [...cur, agent];
    setBusy(`${f.doc_id}:${agent}`);
    // optimistic: patch this file's agents in the current browse cache
    qc.setQueryData(['knowledge', 'browse', here], (prev: any) =>
      prev ? { ...prev, files: prev.files.map((x: BrowseFile) => (x.doc_id === f.doc_id ? { ...x, agents: next } : x)) } : prev);
    try { await setKnowledgeDocAccess(f.doc_id, next); }
    catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao atualizar acesso');
      refresh();
    } finally { setBusy(null); }
  }

  async function handleMove(f: BrowseFile) {
    const folder = moveTo.replace(/^\/+|\/+$/g, '').trim();
    const newSource = folder ? `${folder}/${fileName(f)}` : fileName(f);
    setBusy(`${f.doc_id}:move`);
    try {
      await moveKnowledgeDoc(f.doc_id, newSource);
      toast.success(`Movido para "${folder || 'raiz'}".`);
      setMoveTo(''); setOpenDoc(null); refresh();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Falha ao mover'); }
    finally { setBusy(null); }
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-1 text-sm">
        <button className={cn('rounded px-2 py-1 hover:bg-muted', path.length === 0 && 'font-semibold')} onClick={() => { setPath([]); setOpenDoc(null); }}>
          Conhecimento
        </button>
        {path.map((seg, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            <button className={cn('rounded px-2 py-1 hover:bg-muted', i === path.length - 1 && 'font-semibold')} onClick={() => { setPath(path.slice(0, i + 1)); setOpenDoc(null); }}>
              {seg}
            </button>
          </span>
        ))}
        <div className="ml-auto">
          {newFolder === null ? (
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setNewFolder('')}>
              <FolderPlus className="h-3.5 w-3.5" /> Nova pasta
            </Button>
          ) : (
            <span className="flex items-center gap-1">
              <input autoFocus value={newFolder} onChange={(e) => setNewFolder(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') setNewFolder(null); }}
                placeholder="nome da pasta" maxLength={64}
                className="h-7 w-44 rounded-md border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-primary/40" />
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={createFolder}>Criar</Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setNewFolder(null)}><X className="h-3.5 w-3.5" /></Button>
            </span>
          )}
        </div>
      </div>

      {/* Upload into current folder */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
        className={cn('flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed py-5 text-center text-sm transition-colors',
          dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/40')}
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Upload className="h-4 w-4 text-muted-foreground" />}
        <span className="font-medium">{uploading ? 'Indexando…' : `Enviar para "${here || 'Conhecimento'}"`}</span>
        <span className="text-xs text-muted-foreground">· PDF, TXT, MD, CSV, JSON</span>
        <input ref={fileRef} type="file" multiple accept={ACCEPT} className="hidden"
          onChange={(e) => { if (e.target.files) uploadFiles(e.target.files); e.target.value = ''; }} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <>
          {folders.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {folders.map((fld) => (
                <button key={fld.name} onClick={() => { setPath([...path, fld.name]); setOpenDoc(null); }}
                  className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2.5 text-left hover:border-primary/40 hover:bg-muted/50">
                  <Folder className="h-4 w-4 shrink-0 text-primary/70" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{fld.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{fld.count}</span>
                </button>
              ))}
            </div>
          )}

          {files.length > 0 && (
            <div className="space-y-1.5">
              {files.map((f) => {
                const isOpen = openDoc === f.doc_id;
                const agentsWith = f.agents ?? [];
                return (
                  <div key={f.doc_id} className="rounded-lg border bg-card">
                    <div className="flex items-center gap-2.5 px-3 py-2">
                      <button className="flex min-w-0 flex-1 items-center gap-2.5 text-left" onClick={() => { setOpenDoc(isOpen ? null : f.doc_id); setMoveTo(''); }}>
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{fileName(f)}</span>
                          <span className="block truncate text-xs text-muted-foreground flex items-center gap-1">
                            <Users className="h-3 w-3" />{agentsWith.length ? agentsWith.map(agentLabel).join(', ') : 'sem acesso'}
                          </span>
                        </span>
                        {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                      </button>
                      {statusBadge(f)}
                      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => handleDelete(f)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                    {isOpen && (
                      <div className="space-y-3 border-t px-3 py-2.5">
                        <div>
                          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/60">Agentes com acesso</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {selectableAgents.map((a: any) => {
                              const checked = agentsWith.includes(a.name);
                              const b = busy === `${f.doc_id}:${a.name}`;
                              return (
                                <button key={a.name} disabled={b} onClick={() => toggleAgent(f, a.name)}
                                  className={cn('flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm', checked ? 'border-primary/50 bg-primary/5' : 'border-border hover:bg-muted')}>
                                  <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border', checked ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40')}>
                                    {b ? <Loader2 className="h-3 w-3 animate-spin" /> : checked && <Check className="h-3 w-3" />}
                                  </span>
                                  <span className="truncate font-medium">{agentLabel(a.name)}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <FolderInput className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <input value={moveTo} onChange={(e) => setMoveTo(e.target.value)} placeholder="mover para pasta (ex.: 02_DNA_MP/voz)"
                            className="h-8 flex-1 rounded-md border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-primary/40" />
                          <Button size="sm" variant="outline" disabled={busy === `${f.doc_id}:move`} onClick={() => handleMove(f)}>
                            {busy === `${f.doc_id}:move` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Mover'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {folders.length === 0 && files.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">Pasta vazia. Envie arquivos acima.</p>
          )}
        </>
      )}
    </div>
  );
}
