'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Btn, Glass, Ico, Mono, EmptyState, Skeleton, T, type IcoName } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { ProcedureForm, PROCEDURE_TYPES, type ProcedureFormData } from './procedures/procedure-form';
import { ANATOMICAL_REGIONS } from './procedures/anatomical-region-selector';

interface TabProcedimentosProps {
  patientId: string;
  patientName?: string;
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

function formatDateTime(d: Date | string | null): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function TabProcedimentos({ patientId, patientName }: TabProcedimentosProps) {
  const router = useRouter();
  const [showForm, setShowForm] = React.useState(false);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const listQ = trpc.clinical.encounters.getByPatient.useQuery({
    patientId,
    page: 1,
    pageSize: 50,
  });

  const patientQ = trpc.patients.getById.useQuery(
    { id: patientId },
    { enabled: !patientName, staleTime: 60_000 },
  );

  const resolvedName = patientName ?? patientQ.data?.patient?.name ?? 'Paciente';

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

  function handleFormSubmit(data: ProcedureFormData) {
    // TODO: quando backend suportar criação de procedimento standalone,
    // chamar mutation aqui. Por enquanto, registra via encounter aesthetic.
    // A baixa de estoque/lote será feita quando o endpoint estiver disponível.
    console.warn('[ProcedureForm] submit — precisa de mutation de procedimento standalone', data);
    setShowForm(false);
  }

  if (procedures.length === 0 && !showForm) {
    return (
      <>
        <EmptyState
          label="PROCEDIMENTOS"
          icon="zap"
          title="Nenhum procedimento registrado"
          description="Procedimentos estéticos (peeling, laser, toxina, preenchimento etc.) serão listados aqui com região anatômica, produtos e fotos."
          action={
            <Btn small icon="zap" onClick={() => setShowForm(true)}>
              Registrar procedimento
            </Btn>
          }
        />
        <ProcedureForm
          patientId={patientId}
          patientName={resolvedName}
          open={showForm}
          onClose={() => setShowForm(false)}
          onSubmit={handleFormSubmit}
        />
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Mono size={11} spacing="1.2px" color={T.primary}>
          {procedures.length} {procedures.length === 1 ? 'PROCEDIMENTO' : 'PROCEDIMENTOS'}
        </Mono>
        <Btn variant="glass" small icon="zap" onClick={() => setShowForm(true)}>
          Novo procedimento
        </Btn>
      </div>

      {/* Procedure list */}
      {procedures.map((enc) => {
        const isOpen = expanded === enc.id;
        const procedureType = PROCEDURE_TYPES.find((t) =>
          enc.chiefComplaint?.toLowerCase().includes(t.label.toLowerCase()),
        );
        const typeIcon: IcoName = procedureType?.icon ?? 'zap';

        return (
          <Glass key={enc.id} hover style={{ padding: 0, overflow: 'hidden' }}>
            {/* Clickable header */}
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : enc.id)}
              style={{
                width: '100%', padding: '14px 18px', cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'none', border: 'none', textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: T.r.md,
                  background: T.accentMod.bg, border: `1px solid ${T.accentMod.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ico name={typeIcon} size={18} color={T.accentMod.color} />
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary }}>
                    {enc.chiefComplaint || TYPE_LABEL[enc.type] || 'Procedimento estético'}
                  </p>
                  <Mono size={10}>{formatDateTime(enc.createdAt)}</Mono>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Badge variant={enc.signedAt ? 'success' : 'warning'} dot={false}>
                  {enc.signedAt ? 'Assinado' : 'Rascunho'}
                </Badge>
                <span style={{
                  display: 'inline-flex',
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.15s',
                }}>
                  <Ico name="chevDown" size={16} color={T.textMuted} />
                </span>
              </div>
            </button>

            {/* Expanded content */}
            {isOpen && (
              <div style={{ padding: '0 18px 18px', borderTop: `1px solid ${T.divider}` }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
                  {enc.chiefComplaint && (
                    <div style={{
                      padding: '10px 12px', borderRadius: T.r.md,
                      background: T.primaryBg, border: `1px solid ${T.primaryBorder}`,
                    }}>
                      <Mono size={8} color={T.primary}>PROCEDIMENTO</Mono>
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
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                        {enc.diagnoses.map((d) => (
                          <Badge key={d.code} variant="default" dot={false}>
                            {d.code} — {d.description}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

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

      {/* Procedure form dialog */}
      <ProcedureForm
        patientId={patientId}
        patientName={resolvedName}
        open={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={handleFormSubmit}
      />
    </div>
  );
}
