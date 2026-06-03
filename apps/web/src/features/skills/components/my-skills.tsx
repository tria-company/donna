'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Loader2, Pencil, Plus, Sparkles, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageSearchBar } from '@/components/ui/page-search-bar';
import { PageHeader } from '@/components/ui/page-header';
import { FilterBar, FilterBarItem } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { WorkspaceItemCard } from '@/components/ui/workspace-item-card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import { useSkills, useDeleteSkill, useSkillFavorites, useToggleSkillFavorite } from '../hooks';
import { getSkillSource, SOURCE_META, type Skill } from '../types';
import { SkillFormDialog } from './skill-form-dialog';

type SubFilter = 'all' | 'favorites' | 'project' | 'global' | 'external';

const SUB_FILTERS: { value: SubFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'favorites', label: 'Favoritas' },
  { value: 'project', label: 'Workspace' },
  { value: 'global', label: 'Global' },
  { value: 'external', label: 'Externas' },
];

const SCOPE_PT: Record<string, string> = {
  Project: 'Workspace',
  Global: 'Global',
  External: 'Externa',
};

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-2xl border bg-card p-4 sm:p-5">
          <div className="mb-3 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-3 w-full mb-1" />
          <Skeleton className="h-3 w-4/5 mb-4" />
          <div className="flex justify-end">
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Readonly viewer (built-in / global / external skills) ──────────────────────

function SkillViewDialog({
  skill,
  open,
  onOpenChange,
}: {
  skill: Skill | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">{skill?.name}</DialogTitle>
          <DialogDescription>{skill?.description}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto rounded-lg border bg-muted/30 p-4">
          <pre className="text-xs leading-relaxed text-foreground/80 whitespace-pre-wrap font-mono">
            <code>{skill?.content}</code>
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────

export function MySkills() {
  const [search, setSearch] = useState('');
  const [subFilter, setSubFilter] = useState<SubFilter>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Skill | null>(null);
  const [viewing, setViewing] = useState<Skill | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Skill | null>(null);

  const { data: skills, isLoading } = useSkills();
  const { data: favorites } = useSkillFavorites();
  const toggleFavorite = useToggleSkillFavorite();
  const deleteSkill = useDeleteSkill();

  const favSet = favorites ?? new Set<string>();

  const counts = useMemo(() => {
    const list = skills ?? [];
    return {
      all: list.length,
      favorites: list.filter((s) => favSet.has(s.name)).length,
      project: list.filter((s) => getSkillSource(s.location) === 'project').length,
      global: list.filter((s) => getSkillSource(s.location) === 'global').length,
      external: list.filter((s) => getSkillSource(s.location) === 'external').length,
    } as Record<SubFilter, number>;
  }, [skills, favSet]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (skills ?? []).filter((s) => {
      const matches = !q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
      if (!matches) return false;
      switch (subFilter) {
        case 'favorites': return favSet.has(s.name);
        case 'project':
        case 'global':
        case 'external':
          return getSkillSource(s.location) === subFilter;
        default: return true;
      }
    });
  }, [skills, search, subFilter, favSet]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSkill.mutateAsync({ location: deleteTarget.location });
      toast.success('Skill excluída');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao excluir a skill');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="container mx-auto max-w-7xl px-3 sm:px-4 py-3 sm:py-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500 fill-mode-both">
        <PageHeader icon={Sparkles}>
          <div className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight">
            <span className="text-primary">Minhas Skills</span>
          </div>
        </PageHeader>
      </div>

      <div className="container mx-auto max-w-7xl px-3 sm:px-4">
        {/* Busca + filtros + nova skill */}
        <div className="flex flex-wrap items-center gap-2 pb-3 pt-1">
          <PageSearchBar
            value={search}
            onChange={setSearch}
            placeholder="Buscar skills..."
            className="max-w-sm flex-1 sm:flex-initial"
          />

          <FilterBar className="hidden sm:inline-flex">
            {SUB_FILTERS.map((f) => (
              <FilterBarItem
                key={f.value}
                value={f.value}
                onClick={() => setSubFilter(f.value)}
                data-state={subFilter === f.value ? 'active' : 'inactive'}
              >
                {f.label}
                {counts[f.value] > 0 && <span className="ml-1 opacity-50 tabular-nums">{counts[f.value]}</span>}
              </FilterBarItem>
            ))}
          </FilterBar>

          <Button size="sm" onClick={openCreate} className="ml-auto sm:ml-0">
            <Plus className="h-4 w-4" />
            Nova skill
          </Button>
        </div>

        {/* Grid */}
        <div className="pb-8">
          {isLoading ? (
            <LoadingSkeleton />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-dashed border-border/50">
              <Sparkles className="h-7 w-7 text-muted-foreground/30" />
              <p className="mt-3 text-sm font-medium text-foreground">
                {search ? `Nenhum resultado para "${search}"` : 'Nenhuma skill aqui ainda'}
              </p>
              {!search && (
                <p className="mt-1 text-xs text-muted-foreground text-center max-w-xs">
                  Crie uma skill com o botão "Nova skill" ou instale do Marketplace.
                </p>
              )}
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map((skill, index) => {
                  const source = getSkillSource(skill.location);
                  const editable = source === 'project';
                  const isFav = favSet.has(skill.name);
                  const meta = SCOPE_PT[SOURCE_META[source].label] ?? SOURCE_META[source].label;

                  return (
                    <WorkspaceItemCard
                      key={skill.location}
                      item={{ id: skill.name, name: skill.name, description: skill.description, kindLabel: 'Skill', meta }}
                      index={index}
                      onClick={() => (editable ? (setEditing(skill), setFormOpen(true)) : setViewing(skill))}
                      actions={
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn('h-8 w-8', isFav ? 'text-amber-500' : 'text-muted-foreground hover:text-foreground')}
                            title={isFav ? 'Desfavoritar' : 'Favoritar'}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite.mutate({ name: skill.name, favorite: !isFav });
                            }}
                          >
                            <Star className={cn('h-4 w-4', isFav && 'fill-current')} />
                          </Button>

                          {editable ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                title="Editar"
                                onClick={(e) => { e.stopPropagation(); setEditing(skill); setFormOpen(true); }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                title="Excluir"
                                onClick={(e) => { e.stopPropagation(); setDeleteTarget(skill); }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                              onClick={(e) => { e.stopPropagation(); setViewing(skill); }}
                            >
                              Ver
                            </Button>
                          )}
                        </div>
                      }
                    />
                  );
                })}
              </div>
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Criar / editar */}
      <SkillFormDialog open={formOpen} onOpenChange={setFormOpen} skill={editing} />

      {/* Ver (somente leitura) */}
      <SkillViewDialog skill={viewing} open={Boolean(viewing)} onOpenChange={(o) => !o && setViewing(null)} />

      {/* Confirmar exclusão */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir skill</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a skill <Badge variant="secondary" className="font-mono">{deleteTarget?.name}</Badge>? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteSkill.isPending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteSkill.isPending}>
              {deleteSkill.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
