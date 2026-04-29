'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Glass, Ico, Mono, T } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { useRealtime } from '@/hooks/use-realtime';

interface TabConsultasProps {
  patientId: string;
}

const TYPE_LABEL: Record<string, string> = {
  clinical:     'Consulta clínica',
  aesthetic:    'Procedimento estético',
  followup:     'Retorno',
  emergency:    'Urgência',
  telemedicine: 'Telemedicina',
};

const STATUS_LABEL: Record<string, string> = {
  rascunho:  'Rascunho',
  revisao:   'Em revisão',
  assinado:  'Assinada',
  corrigido: 'Corrigida',
};

const DRAFT_STATUSES = new Set(['rascunho', 'revisao']);

function variantFor(status: string): 'default' | 'success' | 'warning' | 'danger' {
  if (status === 'assinado') return 'success';
  if (status === 'rascunho') return 'warning';
  if (status === 'revisao')  return 'default';
  if (status === 'corrigido') return 'default';
  return 'default';
}

function formatDate(d: Date | string | null): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function TabConsultas({ patientId }: TabConsultasProps) {
  const router = useRouter();
  const listQ = trpc.clinical.encounters.getByPatient.useQuery({
    patientId,
    page:     1,
    pageSize: 20,
  });

  // Realtime: outra sessão criou/assinou encontro nesta clínica → refetch.
  // O backend emite `encounter.updated` para todas as criações e atualizações
  // de encontros — o payload não filtra por paciente, então sempre refazemos
  // a query (cheap: cache do TanStack Query mata flicker se nada mudou).
  useRealtime('encounter.updated', () => {
    void listQ.refetch();
  });

  const encounters = listQ.data?.data ?? [];
  const [expanded, setExpanded] = React.useState<string | null>(encounters[0]?.id ?? null);

  React.useEffect(() => {
    if (expanded === null && encounters.length > 0) {
      setExpanded(encounters[0]!.id);
    }
  }, [encounters, expanded]);

  if (listQ.isLoading) {
    return <p style={{ fontSize: 12, color: T.textMuted }}>Carregando consultas…</p>;
  }
  if (encounters.length === 0) {
    return <p style={{ fontSize: 12, color: T.textMuted }}>Nenhuma consulta registrada.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {encounters.map((enc) => {
        const isOpen = expanded === enc.id;
        const isDraft = DRAFT_STATUSES.has(enc.status);
        return (
          <Glass key={enc.id} hover style={{ padding: 0, overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => {
                if (isDraft) {
                  router.push(`/pacientes/${patientId}/prontuario/consulta/${enc.id}`);
                } else {
                  setExpanded(isOpen ? null : enc.id);
                }
              }}
              style={{
                width: '100%',
                padding: '14px 18px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'none',
                border: 'none',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: T.r.md,
                    background: T.clinical.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ico name="calendar" size={16} color={T.clinical.color} />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>
                    {TYPE_LABEL[enc.type] ?? enc.type}
                  </p>
                  <Mono size={9}>{formatDate(enc.createdAt)}</Mono>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Badge variant={variantFor(enc.status)} dot={false}>
                  {STATUS_LABEL[enc.status] ?? enc.status}
                </Badge>
                <Ico name={isDraft ? 'edit' : isOpen ? 'chevUp' : 'chevDown'} size={16} color={T.textMuted} />
              </div>
            </button>

            {isOpen && !isDraft && (
              <div style={{ padding: '0 18px 18px', borderTop: `1px solid ${T.divider}` }}>
                {(enc.chiefComplaint || enc.diagnoses.length > 0) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
                    {enc.chiefComplaint && (
                      <div
                        style={{
                          padding: '10px 12px',
                          borderRadius: T.r.md,
                          background: T.primaryBg,
                          border: `1px solid ${T.primaryBorder}`,
                        }}
                      >
                        <Mono size={7} color={T.primary}>
                          QUEIXA PRINCIPAL
                        </Mono>
                        <p style={{ fontSize: 12, color: T.textPrimary, marginTop: 4, lineHeight: 1.5 }}>
                          {enc.chiefComplaint}
                        </p>
                      </div>
                    )}
                    {enc.diagnoses.length > 0 && (
                      <div
                        style={{
                          padding: '10px 12px',
                          borderRadius: T.r.md,
                          background: T.glass,
                          border: `1px solid ${T.glassBorder}`,
                        }}
                      >
                        <Mono size={7}>DIAGNÓSTICO</Mono>
                        <p style={{ fontSize: 12, color: T.textPrimary, marginTop: 4 }}>
                          {enc.diagnoses.map((d) => `${d.code} — ${d.description}`).join('; ')}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => router.push(`/pacientes/${patientId}/prontuario/consulta/${enc.id}`)}
                  style={{
                    marginTop: 10,
                    padding: '6px 10px',
                    borderRadius: T.r.sm,
                    background: T.glass,
                    border: `1px solid ${T.glassBorder}`,
                    fontSize: 11,
                    color: T.textSecondary,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Ico name="eye" size={12} color={T.textMuted} /> Ver detalhes
                </button>
              </div>
            )}
          </Glass>
        );
      })}
    </div>
  );
}
