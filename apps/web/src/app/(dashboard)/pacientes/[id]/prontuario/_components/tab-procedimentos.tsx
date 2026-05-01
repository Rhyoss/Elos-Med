'use client';

import * as React from 'react';
import { Badge, Btn, Glass, Ico, Mono, EmptyState, Skeleton, T } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';

interface TabProcedimentosProps {
  patientId: string;
}

const TYPE_LABEL: Record<string, string> = {
  clinical:     'Consulta clínica',
  aesthetic:    'Procedimento estético',
  followup:     'Retorno',
  emergency:    'Urgência',
  telemedicine: 'Telemedicina',
};

function formatDate(d: Date | string | null): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function TabProcedimentos({ patientId }: TabProcedimentosProps) {
  const listQ = trpc.clinical.encounters.getByPatient.useQuery({
    patientId,
    page: 1,
    pageSize: 50,
  });

  if (listQ.isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} height={90} delay={i * 80} />
        ))}
      </div>
    );
  }

  const allEncounters = listQ.data?.data ?? [];
  const procedures = allEncounters.filter((e) => e.type === 'aesthetic');

  if (procedures.length === 0) {
    return (
      <EmptyState
        label="PROCEDIMENTOS"
        icon="zap"
        title="Nenhum procedimento registrado"
        description="Procedimentos estéticos (peeling, laser, toxina, preenchimento etc.) serão listados aqui com região anatômica, produtos e fotos."
        action={
          <Btn small icon="zap" disabled>
            Registrar procedimento
          </Btn>
        }
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Mono size={11} spacing="1.2px" color={T.primary}>
          {procedures.length} {procedures.length === 1 ? 'PROCEDIMENTO' : 'PROCEDIMENTOS'}
        </Mono>
      </div>

      {procedures.map((enc) => (
        <Glass key={enc.id} hover style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: T.r.md,
                background: T.accentMod.bg, border: `1px solid ${T.accentMod.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Ico name="zap" size={18} color={T.accentMod.color} />
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary }}>
                  {TYPE_LABEL[enc.type] ?? enc.type}
                </p>
                <Mono size={10}>{formatDate(enc.createdAt)}</Mono>
              </div>
            </div>
            <Badge variant={enc.signedAt ? 'success' : 'warning'} dot={false}>
              {enc.signedAt ? 'Assinado' : 'Rascunho'}
            </Badge>
          </div>

          {enc.chiefComplaint && (
            <div style={{
              padding: '10px 12px', borderRadius: T.r.md,
              background: T.glass, border: `1px solid ${T.glassBorder}`,
              marginBottom: 10,
            }}>
              <Mono size={8}>DESCRIÇÃO</Mono>
              <p style={{ fontSize: 13, color: T.textPrimary, marginTop: 4, lineHeight: 1.5 }}>
                {enc.chiefComplaint}
              </p>
            </div>
          )}

          {enc.diagnoses.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {enc.diagnoses.map((d) => (
                <Badge key={d.code} variant="default" dot={false}>
                  {d.code} — {d.description}
                </Badge>
              ))}
            </div>
          )}
        </Glass>
      ))}
    </div>
  );
}
