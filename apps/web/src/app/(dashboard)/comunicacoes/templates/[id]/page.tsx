'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@dermaos/ui';
import { Btn, Glass, Mono, PageHero, T } from '@dermaos/ui/ds';
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
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div
          aria-label="Carregando…"
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: `2px solid ${T.primary}`,
            borderTopColor: 'transparent',
            animation: 'ds-spin 0.7s linear infinite',
          }}
        />
      </div>
    );
  }

  if (query.isError || !template) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
        <Mono size={9} color={T.danger}>TEMPLATE NÃO ENCONTRADO</Mono>
        <Btn variant="glass" icon="arrowLeft" onClick={() => router.back()}>Voltar</Btn>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '20px 26px 12px', flexShrink: 0 }}>
        <PageHero
          eyebrow="EDITOR DE TEMPLATE"
          title={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {template.name}
              {template.channel_type && (
                <Badge variant="outline" size="sm">
                  {CHANNEL_LABEL[template.channel_type] ?? template.channel_type}
                </Badge>
              )}
              {template.is_default && <Badge variant="outline" size="sm">Padrão</Badge>}
            </span>
          }
          module="aiMod"
          icon="file"
          actions={
            <Link href="/comunicacoes/templates" style={{ textDecoration: 'none' }}>
              <Btn variant="glass" small icon="arrowLeft">Voltar</Btn>
            </Link>
          }
        />

        {(updateMutation.isSuccess || restoreMutation.isSuccess) && (
          <div
            role="status"
            aria-live="polite"
            style={{
              marginTop: 10,
              padding: '10px 12px',
              borderRadius: T.r.md,
              background: T.successBg,
              border: `1px solid ${T.successBorder}`,
              color: T.success,
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            Template salvo com sucesso.
          </div>
        )}

        {(updateMutation.isError || restoreMutation.isError) && (
          <div
            role="alert"
            style={{
              marginTop: 10,
              padding: '10px 12px',
              borderRadius: T.r.md,
              background: T.dangerBg,
              border: `1px solid ${T.dangerBorder}`,
              color: T.danger,
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            {updateMutation.error?.message ?? restoreMutation.error?.message}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0, padding: '0 26px 22px' }}>
        <TemplateEditor
          template={template}
          mode="edit"
          isSaving={updateMutation.isPending || restoreMutation.isPending}
          canRestore={template.is_default}
          onSave={(data) => handleSave(data as UpdateTemplateInput)}
          onRestore={handleRestore}
        />
      </div>
    </div>
  );
}
