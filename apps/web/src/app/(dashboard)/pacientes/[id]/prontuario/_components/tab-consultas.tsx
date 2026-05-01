'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Btn, Glass, Ico, Mono, EmptyState, Skeleton, T } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { useRealtime } from '@/hooks/use-realtime';

interface TabConsultasProps {
  patientId: string;
  onNovaConsulta?: () => void;
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
  return 'default';
}

function formatDate(d: Date | string | null): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(d: Date | string | null): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function TabConsultas({ patientId, onNovaConsulta }: TabConsultasProps) {
  const router = useRouter();
  const listQ = trpc.clinical.encounters.getByPatient.useQuery({
    patientId,
    page:     1,
    pageSize: 50,
  });

  useRealtime('encounter.updated', () => {
    void listQ.refetch();
  });

  const encounters = listQ.data?.data ?? [];
  const [expanded, setExpanded] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (expanded === null && encounters.length > 0) {
      setExpanded(encounters[0]!.id);
    }
  }, [encounters, expanded]);

  if (listQ.isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} height={80} delay={i * 80} />
        ))}
      </div>
    );
  }

  if (encounters.length === 0) {
    return (
      <EmptyState
        label="CONSULTAS"
        icon="calendar"
        title="Nenhuma consulta registrada"
        description="Registre a primeira consulta deste paciente para começar a construir o histórico clínico."
        action={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            {onNovaConsulta && (
              <Btn small icon="edit" onClick={onNovaConsulta}>Nova consulta</Btn>
            )}
          </div>
        }
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Mono size={11} spacing="1.2px" color={T.primary}>
          {encounters.length} {encounters.length === 1 ? 'CONSULTA' : 'CONSULTAS'}
        </Mono>
        {onNovaConsulta && (
          <Btn variant="ghost" small icon="edit" onClick={onNovaConsulta}>Nova consulta</Btn>
        )}
      </div>

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
                width: '100%', padding: '14px 18px', cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'none', border: 'none', textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: T.r.md,
                  background: T.clinical.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ico name="calendar" size={17} color={T.clinical.color} />
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
                    {TYPE_LABEL[enc.type] ?? enc.type}
                  </p>
                  <Mono size={10}>{formatDateTime(enc.createdAt)}</Mono>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {enc.signedAt && (
                  <Mono size={9} color={T.textMuted}>
                    Assinada {formatDate(enc.signedAt)}
                  </Mono>
                )}
                <Badge variant={variantFor(enc.status)} dot={false}>
                  {STATUS_LABEL[enc.status] ?? enc.status}
                </Badge>
                <span style={{
                  display: 'inline-flex',
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.15s',
                }}>
                  <Ico name={isDraft ? 'edit' : 'chevDown'} size={16} color={T.textMuted} />
                </span>
              </div>
            </button>

            {isOpen && !isDraft && (
              <div style={{ padding: '0 18px 18px', borderTop: `1px solid ${T.divider}` }}>
                {(enc.chiefComplaint || enc.diagnoses.length > 0) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
                    {enc.chiefComplaint && (
                      <div style={{
                        padding: '10px 12px', borderRadius: T.r.md,
                        background: T.primaryBg, border: `1px solid ${T.primaryBorder}`,
                      }}>
                        <Mono size={8} color={T.primary}>QUEIXA PRINCIPAL</Mono>
                        <p style={{ fontSize: 13, color: T.textPrimary, marginTop: 4, lineHeight: 1.5 }}>
                          {enc.chiefComplaint}
                        </p>
                      </div>
                    )}
                    {enc.diagnoses.length > 0 && (
                      <div style={{
                        padding: '10px 12px', borderRadius: T.r.md,
                        background: T.glass, border: `1px solid ${T.glassBorder}`,
                      }}>
                        <Mono size={8}>DIAGNÓSTICO</Mono>
                        <p style={{ fontSize: 13, color: T.textPrimary, marginTop: 4 }}>
                          {enc.diagnoses.map((d) => `${d.code} — ${d.description}`).join('; ')}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                  <Btn
                    variant="glass"
                    small
                    icon="eye"
                    onClick={() => router.push(`/pacientes/${patientId}/prontuario/consulta/${enc.id}`)}
                  >
                    Ver detalhes
                  </Btn>
                </div>
              </div>
            )}
          </Glass>
        );
      })}
    </div>
  );
}
