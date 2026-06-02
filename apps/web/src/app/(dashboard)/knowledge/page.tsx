'use client';

import { KnowledgeExplorer } from '@/components/dashboard/knowledge-explorer';

export default function KnowledgePage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Conhecimento</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Base de documentos da conta, organizada por pastas. Escolha quais agentes podem consultar cada documento.
        </p>
      </div>
      <KnowledgeExplorer />
    </div>
  );
}
