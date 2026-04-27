'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Badge } from '@dermaos/ui';
import { ArrowLeft } from 'lucide-react';
import { trpc } from '@/lib/trpc-provider';
import { TemplateEditor } from '../_components/template-editor';
import type { UpdateTemplateInput } from '@dermaos/shared';
import type { TemplateRow } from '@/lib/types/template';

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  sms:      'SMS',
  email:    'E-mail',
};

export default function TemplateEditPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();
  const utils   = trpc.useUtils();

  const query = trpc.templates.getById.useQuery(
    { id },
    { enabled: !!id && id !== 'novo' },
  );

  const updateMutation  = trpc.templates.update.useMutation({
    onSuccess: () => {
      void utils.templates.list.invalidate();
      void query.refetch();
    },
  });
  const restoreMutation = trpc.templates.restoreDefault.useMutation({
    onSuccess: () => void query.refetch(),
  });

  const template = query.data?.template as TemplateRow | undefined;

  async function handleSave(data: UpdateTemplateInput) {
    await updateMutation.mutateAsync(data);
  }

  async function handleRestore() {
    if (!id) return;
    if (!confirm('Restaurar o conteúdo padrão deste template? Sua edição atual será perdida.')) return;
    await restoreMutation.mutateAsync({ id });
  }

  if (query.isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Carregando…" />
      </div>
    );
  }

  if (query.isError || !template) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-sm text-destructive">Template não encontrado.</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      {/* Breadcrumb / header */}
      <div className="flex items-center gap-3">
        <Link href="/comunicacoes/templates" aria-label="Voltar para templates">
          <Button size="icon-sm" variant="ghost">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
        </Link>
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-lg font-semibold">{template.name}</h1>
          {template.channel_type && (
            <Badge variant="outline" size="sm">
              {CHANNEL_LABEL[template.channel_type] ?? template.channel_type}
            </Badge>
          )}
          {template.is_default && (
            <Badge variant="outline" size="sm">Padrão</Badge>
          )}
        </div>
      </div>

      {/* Feedback de sucesso */}
      {(updateMutation.isSuccess || restoreMutation.isSuccess) && (
        <div
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
          role="status"
          aria-live="polite"
        >
          Template salvo com sucesso.
        </div>
      )}

      {/* Feedback de erro */}
      {(updateMutation.isError || restoreMutation.isError) && (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {updateMutation.error?.message ?? restoreMutation.error?.message}
        </div>
      )}

      {/* Editor */}
      <div className="flex min-h-0 flex-1">
        <TemplateEditor
          template={template}
          mode="edit"
          isSaving={updateMutation.isPending || restoreMutation.isPending}
          canRestore={template.is_default}
          onSave={handleSave as (data: UpdateTemplateInput) => void}
          onRestore={handleRestore}
        />
      </div>
    </div>
  );
}
