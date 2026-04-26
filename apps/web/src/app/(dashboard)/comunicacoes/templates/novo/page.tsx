'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Btn, PageHero, T } from '@dermaos/ui/ds';
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '20px 26px 12px', flexShrink: 0 }}>
        <PageHero
          eyebrow="NOVO TEMPLATE · BIBLIOTECA"
          title="Novo Template"
          module="aiMod"
          icon="file"
          actions={
            <Link href="/comunicacoes/templates" style={{ textDecoration: 'none' }}>
              <Btn variant="glass" small icon="arrowLeft">Voltar</Btn>
            </Link>
          }
        />
        {createMutation.isError && (
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
            {createMutation.error.message}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0, padding: '0 26px 22px' }}>
        <TemplateEditor
          mode="create"
          isSaving={createMutation.isPending}
          onSave={handleSave as (data: CreateTemplateInput) => void}
        />
      </div>
    </div>
  );
}
