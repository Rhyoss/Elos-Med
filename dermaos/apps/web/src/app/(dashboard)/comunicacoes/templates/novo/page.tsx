'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@dermaos/ui';
import { ArrowLeft } from 'lucide-react';
import { trpc } from '@/lib/trpc-provider';
import { TemplateEditor } from '../_components/template-editor';
import type { CreateTemplateInput } from '@dermaos/shared';

export default function TemplateNovoPage() {
  const router = useRouter();
  const utils  = trpc.useUtils();

  const createMutation = trpc.templates.create.useMutation({
    onSuccess: (data) => {
      void utils.templates.list.invalidate();
      router.replace(`/comunicacoes/templates/${data.template.id}`);
    },
  });

  async function handleSave(data: CreateTemplateInput) {
    await createMutation.mutateAsync(data);
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/comunicacoes/templates" aria-label="Voltar para templates">
          <Button size="icon-sm" variant="ghost">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">Novo Template</h1>
      </div>

      {/* Erro */}
      {createMutation.isError && (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {createMutation.error.message}
        </div>
      )}

      {/* Editor */}
      <div className="flex min-h-0 flex-1">
        <TemplateEditor
          mode="create"
          isSaving={createMutation.isPending}
          onSave={handleSave as (data: CreateTemplateInput) => void}
        />
      </div>
    </div>
  );
}
