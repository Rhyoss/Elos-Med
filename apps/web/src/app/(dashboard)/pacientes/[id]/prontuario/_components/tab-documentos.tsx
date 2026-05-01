'use client';

import * as React from 'react';
import { Badge, Btn, Glass, Ico, Mono, EmptyState, Skeleton, T } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { PRESCRIPTION_STATUS_LABELS } from '@dermaos/shared';

interface TabDocumentosProps {
  patientId: string;
  onNovoDocumento?: () => void;
}

function formatDate(d: Date | string | null): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface DocumentItem {
  id: string;
  type: 'prescricao' | 'termo' | 'atestado' | 'declaracao' | 'outro';
  title: string;
  date: Date | string;
  signed: boolean;
  status: string;
}

export function TabDocumentos({ patientId, onNovoDocumento }: TabDocumentosProps) {
  const prescriptionsQ = trpc.clinical.prescriptions.listByPatient.useQuery({
    patientId,
    page:     1,
    pageSize: 50,
  });

  if (prescriptionsQ.isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} height={70} delay={i * 80} />
        ))}
      </div>
    );
  }

  const prescriptions = prescriptionsQ.data?.data ?? [];

  const documents: DocumentItem[] = prescriptions.map((rx) => ({
    id:     rx.id,
    type:   'prescricao' as const,
    title:  `Prescrição ${rx.prescriptionNumber ?? rx.id.slice(0, 8).toUpperCase()}`,
    date:   rx.signedAt ?? rx.createdAt,
    signed: !!rx.signedAt,
    status: rx.status,
  }));

  // TODO: quando backend expor documentos genéricos (termos, atestados, declarações),
  // integrar aqui via trpc.clinical.documents.listByPatient

  if (documents.length === 0) {
    return (
      <EmptyState
        label="DOCUMENTOS"
        icon="file"
        title="Nenhum documento"
        description="Termos de consentimento, receitas, atestados e declarações aparecerão aqui quando gerados."
        action={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            {onNovoDocumento && (
              <Btn small icon="file" onClick={onNovoDocumento}>Novo documento</Btn>
            )}
          </div>
        }
      />
    );
  }

  const TYPE_ICON: Record<string, 'file' | 'check' | 'edit'> = {
    prescricao: 'file',
    termo:      'check',
    atestado:   'edit',
    declaracao: 'file',
    outro:      'file',
  };

  const TYPE_LABEL: Record<string, string> = {
    prescricao: 'Prescrição',
    termo:      'Termo de consentimento',
    atestado:   'Atestado',
    declaracao: 'Declaração',
    outro:      'Documento',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Mono size={11} spacing="1.2px" color={T.primary}>
          {documents.length} {documents.length === 1 ? 'DOCUMENTO' : 'DOCUMENTOS'}
        </Mono>
        {onNovoDocumento && (
          <Btn variant="ghost" small icon="file" onClick={onNovoDocumento}>Novo documento</Btn>
        )}
      </div>

      {documents.map((doc) => (
        <Glass key={doc.id} hover style={{ padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: T.r.md,
                background: T.primaryBg, border: `1px solid ${T.primaryBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Ico name={TYPE_ICON[doc.type] ?? 'file'} size={17} color={T.primary} />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
                  {doc.title}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <Mono size={10}>{formatDate(doc.date)}</Mono>
                  <span style={{ color: T.textMuted, fontSize: 10 }}>·</span>
                  <Mono size={10} color={T.textMuted}>
                    {TYPE_LABEL[doc.type] ?? doc.type}
                  </Mono>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {doc.signed ? (
                <Badge variant="success" dot={false}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <Ico name="check" size={11} color={T.success} />
                    Assinado
                  </span>
                </Badge>
              ) : (
                <Badge variant="warning" dot={false}>
                  {(PRESCRIPTION_STATUS_LABELS as Record<string, string>)[doc.status] ?? doc.status}
                </Badge>
              )}
            </div>
          </div>
        </Glass>
      ))}
    </div>
  );
}
