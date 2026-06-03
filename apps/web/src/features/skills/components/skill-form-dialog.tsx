'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { useCreateSkill, useUpdateSkill } from '../hooks';
import {
  parseSkillFileContent,
  validateSkillName,
  validateSkillDescription,
  type Skill,
} from '../types';

interface SkillFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits this skill; otherwise it creates a new one. */
  skill?: Skill | null;
}

/**
 * Dialog para criar (upload manual) e editar skills.
 * Reusa os validadores e serializadores de ../types e os hooks de CRUD.
 * O nome é imutável na edição (o nome = diretório da skill).
 */
export function SkillFormDialog({ open, onOpenChange, skill }: SkillFormDialogProps) {
  const isEdit = Boolean(skill);
  const createSkill = useCreateSkill();
  const updateSkill = useUpdateSkill();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset/popular o formulário sempre que abrir ou trocar a skill.
  useEffect(() => {
    if (!open) return;
    if (skill) {
      const parsed = parseSkillFileContent(skill.content);
      setName(skill.name);
      setDescription(parsed?.description ?? skill.description ?? '');
      setBody(parsed?.body ?? '');
    } else {
      setName('');
      setDescription('');
      setBody('');
    }
    setError(null);
  }, [open, skill]);

  const isPending = createSkill.isPending || updateSkill.isPending;

  const handleSubmit = async () => {
    setError(null);
    const descErr = validateSkillDescription(description);
    if (descErr) {
      setError(descErr);
      return;
    }

    try {
      if (isEdit && skill) {
        await updateSkill.mutateAsync({
          name: skill.name,
          input: { location: skill.location, description, body },
        });
        toast.success('Skill atualizada');
      } else {
        const nameErr = validateSkillName(name);
        if (nameErr) {
          setError(nameErr);
          return;
        }
        await createSkill.mutateAsync({ name, description, body });
        toast.success('Skill criada');
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar a skill');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar skill' : 'Nova skill'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Edite a descrição e as instruções desta skill.'
              : 'Crie uma skill informando nome, descrição e instruções (markdown).'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="skill-name">Nome</Label>
            <Input
              id="skill-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="minha-skill"
              disabled={isEdit}
              className="font-mono"
            />
            {!isEdit && (
              <p className="text-xs text-muted-foreground">
                Letras minúsculas, números e hífens (ex.: <code>pesquisa-profunda</code>). Não pode ser alterado depois.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="skill-description">Descrição</Label>
            <Textarea
              id="skill-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="O que a skill faz e quando deve ser usada (sempre visível ao agente)."
              className="min-h-[72px] resize-y"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="skill-body">Instruções (markdown)</Label>
            <Textarea
              id="skill-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Passo a passo, fluxos e regras da skill..."
              className="min-h-[220px] resize-y font-mono text-sm leading-relaxed"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Salvar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
