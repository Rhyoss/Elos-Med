'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Btn, Glass, Ico, Mono, EmptyState, Skeleton, T, type IcoName } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { useCreateAppointment } from '@/lib/hooks/use-scheduling';
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
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = React.useState(false);

  const listQ = trpc.clinical.encounters.getByPatient.useQuery({
    patientId,
    page: 1,
    pageSize: 50,
  });

  const patientQ = trpc.patients.getById.useQuery(
    { id: patientId },
    { enabled: !patientName, staleTime: 60_000 },
  );

  const utils = trpc.useUtils();
  const createAppointmentMut = useCreateAppointment(patientId);

  const resolvedName = patientName ?? patientQ.data?.patient?.name ?? 'Paciente';

  React.useEffect(() => {
    if (submitSuccess) {
      const timer = setTimeout(() => setSubmitSuccess(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [submitSuccess]);

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

  async function handleFormSubmit(data: ProcedureFormData) {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const typeLabel = PROCEDURE_TYPES.find((t) => t.id === data.type)?.label ?? data.type;
      const regionLabels = data.regions
        .map((r) => ANATOMICAL_REGIONS.find((a) => a.id === r)?.label ?? r)
        .join(', ');

      const structuredData: Record<string, unknown> = {
        procedureType: data.type,
        procedureName: data.customName || typeLabel,
        regions: data.regions,
        regionLabels,
        products: data.products.map((p) => ({
          productId: p.productId,
          productName: p.productName,
          quantity: p.quantity,
          unit: p.unit,
          lotId: p.lotId,
          lotNumber: p.lotNumber,
          expiryDate: p.expiryDate,
        })),
        consentAttached: data.consentAttached,
        consentNotes: data.consentNotes,
        photosBefore: data.photosBefore,
        photosAfter: data.photosAfter,
        orientations: data.orientations,
        returnDays: data.returnDays,
        returnNotes: data.returnNotes,
        durationMin: data.durationMin,
        scheduleReturn: data.scheduleReturn,
      };

      // TODO: quando endpoint standalone de procedimento existir, usar mutation direta.
      // Por enquanto, usamos encounter update com structuredData para registrar o procedimento.
      // A baixa de estoque por lote requer encounterId — será feita após criação do encounter.
      // Tracking: os dados do procedimento ficam em structuredData do encounter aesthetic.

      // Para registro imediato sem appointmentId, salvamos em localStorage como draft
      // até que o backend suporte criação de encounter sem appointment.
      const draftKey = `procedure_draft_${patientId}_${Date.now()}`;
      const draft = {
        patientId,
        type: 'aesthetic',
        chiefComplaint: data.customName || typeLabel,
        structuredData,
        createdAt: new Date().toISOString(),
        status: 'pending_encounter',
      };
      localStorage.setItem(draftKey, JSON.stringify(draft));

      // Schedule return appointment if requested
      if (data.scheduleReturn && data.returnDays && data.returnDays > 0) {
        const returnDate = new Date();
        returnDate.setDate(returnDate.getDate() + data.returnDays);
        returnDate.setHours(9, 0, 0, 0);

        try {
          await createAppointmentMut.mutateAsync({
            patientId,
            providerId: '', // TODO: usar providerId do profissional logado
            type: 'followup',
            scheduledAt: returnDate,
            durationMin: 30,
            internalNotes: `Retorno: ${data.customName || typeLabel}. ${data.returnNotes ?? ''}`.trim(),
          });
        } catch {
          // Non-blocking — appointment creation failure shouldn't prevent procedure registration
        }
      }

      // Stock consumption — register exit movements for products with lots
      // TODO: quando o backend de movimentação suportar batch de saídas por procedimento,
      // substituir por uma chamada unificada.
      for (const product of data.products) {
        if (product.lotId && product.quantity > 0) {
          try {
            await utils.client.supply.movements.register.mutate({
              type: 'saida' as const,
              productId: product.productId,
              lotId: product.lotId,
              quantity: product.quantity,
              reason: 'procedimento' as const,
              encounterId: null,
              notes: `Procedimento: ${data.customName || typeLabel} — Paciente ${patientId.slice(0, 8)}`,
            });
          } catch (err) {
            console.warn('[ProcedureForm] Falha na baixa de estoque para', product.productName, err);
          }
        }
      }

      void utils.clinical.encounters.getByPatient.invalidate({ patientId });
      void utils.supply.lots.fefoSuggest.invalidate();
      void utils.supply.lots.list.invalidate();

      setSubmitSuccess(true);
      setShowForm(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao registrar procedimento';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (procedures.length === 0 && !showForm) {
    return (
      <>
        {submitSuccess && <SuccessBanner />}
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
          isSubmitting={isSubmitting}
        />
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {submitSuccess && <SuccessBanner />}

      {submitError && (
        <div style={{
          padding: '10px 14px', borderRadius: T.r.md,
          background: T.dangerBg, border: `1px solid ${T.dangerBorder}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Ico name="alert" size={14} color={T.danger} />
            <p style={{ fontSize: 13, color: T.danger }}>{submitError}</p>
          </div>
          <button
            type="button" onClick={() => setSubmitError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <Ico name="x" size={14} color={T.danger} />
          </button>
        </div>
      )}

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
        const sd = enc.structuredData as Record<string, unknown> | null;
        const procedureType = sd?.procedureType as string | undefined;
        const procedureName = sd?.procedureName as string | undefined;
        const regions = sd?.regionLabels as string | undefined;
        const products = (sd?.products ?? []) as Array<{
          productName: string;
          quantity: number;
          unit: string;
          lotNumber?: string;
        }>;
        const orientations = sd?.orientations as string | undefined;
        const returnDays = sd?.returnDays as number | undefined;
        const durationMin = sd?.durationMin as number | undefined;
        const consentAttached = sd?.consentAttached as boolean | undefined;
        const photosBefore = (sd?.photosBefore ?? []) as Array<{ id: string; name: string }>;
        const photosAfter = (sd?.photosAfter ?? []) as Array<{ id: string; name: string }>;

        const matchedType = PROCEDURE_TYPES.find((t) =>
          t.id === procedureType || enc.chiefComplaint?.toLowerCase().includes(t.label.toLowerCase()),
        );
        const typeIcon: IcoName = matchedType?.icon ?? 'zap';
        const displayName = procedureName || enc.chiefComplaint || TYPE_LABEL[enc.type] || 'Procedimento estético';

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
                    {displayName}
                  </p>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                    <Mono size={10}>{formatDateTime(enc.createdAt)}</Mono>
                    {regions && (
                      <>
                        <span style={{ color: T.textMuted, fontSize: 10 }}>·</span>
                        <Mono size={10} color={T.clinical.color}>{regions}</Mono>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {products.length > 0 && (
                  <Badge variant="default" dot={false}>
                    {products.length} prod.
                  </Badge>
                )}
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
                  {/* Procedure type */}
                  <DetailBlock label="PROCEDIMENTO" color={T.primary} bg={T.primaryBg} border={T.primaryBorder}>
                    {displayName}
                  </DetailBlock>

                  {/* Region */}
                  {regions && (
                    <DetailBlock label="REGIÃO ANATÔMICA" color={T.clinical.color} bg={T.clinical.bg} border={T.clinical.border}>
                      {regions}
                    </DetailBlock>
                  )}
                </div>

                {/* Products consumed */}
                {products.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <Mono size={9} spacing="0.5px" color={T.textMuted} style={{ marginBottom: 6 }}>
                      PRODUTOS UTILIZADOS
                    </Mono>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {products.map((p, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '6px 10px', borderRadius: T.r.md,
                          background: T.supply.bg, border: `1px solid ${T.supply.border}`,
                        }}>
                          <Ico name="box" size={12} color={T.supply.color} />
                          <span style={{ fontSize: 13, color: T.textPrimary, flex: 1 }}>
                            {p.productName}
                          </span>
                          <Mono size={10} color={T.supply.color}>
                            {p.quantity} {p.unit}
                            {p.lotNumber && ` · Lote ${p.lotNumber}`}
                          </Mono>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Photos */}
                {(photosBefore.length > 0 || photosAfter.length > 0) && (
                  <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                    {photosBefore.length > 0 && (
                      <div style={{ flex: 1 }}>
                        <Mono size={9} color={T.textMuted} style={{ marginBottom: 4 }}>FOTOS ANTES</Mono>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {photosBefore.map((p) => (
                            <span key={p.id} style={{
                              padding: '3px 8px', borderRadius: T.r.sm,
                              background: T.clinical.bg, border: `1px solid ${T.clinical.border}`,
                              fontSize: 11, color: T.clinical.color,
                            }}>
                              {p.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {photosAfter.length > 0 && (
                      <div style={{ flex: 1 }}>
                        <Mono size={9} color={T.textMuted} style={{ marginBottom: 4 }}>FOTOS DEPOIS</Mono>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {photosAfter.map((p) => (
                            <span key={p.id} style={{
                              padding: '3px 8px', borderRadius: T.r.sm,
                              background: T.successBg, border: `1px solid ${T.successBorder}`,
                              fontSize: 11, color: T.success,
                            }}>
                              {p.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Additional info row */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                  {durationMin && (
                    <span style={{
                      padding: '4px 10px', borderRadius: T.r.md,
                      background: T.glass, border: `1px solid ${T.glassBorder}`,
                      fontSize: 12, color: T.textSecondary,
                    }}>
                      <Ico name="clock" size={11} color={T.textMuted} /> {durationMin} min
                    </span>
                  )}
                  {consentAttached && (
                    <span style={{
                      padding: '4px 10px', borderRadius: T.r.md,
                      background: T.successBg, border: `1px solid ${T.successBorder}`,
                      fontSize: 12, color: T.success,
                    }}>
                      <Ico name="check" size={11} color={T.success} /> Termo anexado
                    </span>
                  )}
                  {returnDays && (
                    <span style={{
                      padding: '4px 10px', borderRadius: T.r.md,
                      background: T.primaryBg, border: `1px solid ${T.primaryBorder}`,
                      fontSize: 12, color: T.primary,
                    }}>
                      <Ico name="calendar" size={11} color={T.primary} /> Retorno {returnDays}d
                    </span>
                  )}
                </div>

                {/* Orientations */}
                {orientations && (
                  <div style={{
                    marginTop: 10, padding: '10px 12px', borderRadius: T.r.md,
                    background: T.infoBg, border: `1px solid ${T.infoBorder}`,
                  }}>
                    <Mono size={9} color={T.info} style={{ marginBottom: 4 }}>ORIENTAÇÕES PÓS-PROCEDIMENTO</Mono>
                    <p style={{ fontSize: 13, color: T.textPrimary, lineHeight: 1.5 }}>{orientations}</p>
                  </div>
                )}

                {/* Diagnoses */}
                {enc.diagnoses.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <Mono size={9} color={T.textMuted} style={{ marginBottom: 4 }}>DIAGNÓSTICO</Mono>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {enc.diagnoses.map((d) => (
                        <Badge key={d.code} variant="default" dot={false}>
                          {d.code} — {d.description}
                        </Badge>
                      ))}
                    </div>
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

      {/* Procedure form dialog */}
      <ProcedureForm
        patientId={patientId}
        patientName={resolvedName}
        open={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={handleFormSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}

/* ── Detail block helper ─────────────────────────────────────────────── */

function DetailBlock({
  label,
  color,
  bg,
  border,
  children,
}: {
  label: string;
  color: string;
  bg: string;
  border: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: T.r.md,
      background: bg, border: `1px solid ${border}`,
    }}>
      <Mono size={8} color={color}>{label}</Mono>
      <p style={{ fontSize: 13, color: T.textPrimary, marginTop: 4, lineHeight: 1.5 }}>
        {children}
      </p>
    </div>
  );
}

/* ── Success banner ──────────────────────────────────────────────────── */

function SuccessBanner() {
  return (
    <div style={{
      padding: '10px 14px', borderRadius: T.r.md,
      background: T.successBg, border: `1px solid ${T.successBorder}`,
      display: 'flex', gap: 8, alignItems: 'center',
      animation: 'fadeIn 0.3s ease',
    }}>
      <Ico name="check" size={16} color={T.success} />
      <p style={{ fontSize: 13, color: T.success, fontWeight: 500 }}>
        Procedimento registrado com sucesso
      </p>
    </div>
  );
}
