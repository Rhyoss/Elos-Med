'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  SheetRoot,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
} from '@dermaos/ui';
import { Badge, Btn, Glass, Ico, Mono, T } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { STATUS_LABEL, formatSlotRange } from '@/lib/agenda-utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/* ── Types ─────────────────────────────────────────────────────────────── */

export interface AppointmentCardData {
  id:           string;
  patientId:    string;
  providerId:   string;
  scheduledAt:  Date | string;
  endsAt?:      Date | string;
  durationMin:  number;
  room:         string | null;
  type:         string;
  status:       string;
  source:       string;
  patientNotes: string | null;
  internalNotes: string | null;
  statusHistory: Array<{ status: string; changed_at: string; changed_by: string | null; reason?: string; via?: string }>;
  patient: {
    id:       string;
    name:     string;
    photoUrl: string | null;
    age:      number | null;
    allergiesSummary: string;
    allergiesCount:   number;
  };
  provider: { id: string; name: string };
  service:  { id: string; name: string } | null;
}

/* ── Status → badge variant mapping ────────────────────────────────────── */

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  scheduled:   'default',
  confirmed:   'success',
  waiting:     'warning',
  checked_in:  'success',
  in_progress: 'info',
  completed:   'default',
  cancelled:   'danger',
  no_show:     'warning',
  rescheduled: 'info',
};

/* ── Helpers ───────────────────────────────────────────────────────────── */

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function formatSource(s: string): string {
  const map: Record<string, string> = {
    phone: 'Telefone',
    whatsapp: 'WhatsApp',
    portal: 'Portal do Paciente',
    walk_in: 'Presencial',
    web: 'Website',
    manual: 'Manual',
  };
  return map[s] ?? s.replace(/_/g, ' ');
}

function formatTs(ts: string | Date): string {
  const d = typeof ts === 'string' ? new Date(ts) : ts;
  if (Number.isNaN(d.getTime())) return String(ts);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/* ── Component ─────────────────────────────────────────────────────────── */

interface Props {
  appointment: AppointmentCardData | null;
  open:        boolean;
  onOpenChange: (open: boolean) => void;
  onMutated?:  () => void;
}

export function AppointmentDetailSheet({ appointment, open, onOpenChange, onMutated }: Props) {
  const router = useRouter();
  const [cancelOpen,  setCancelOpen]  = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');

  const confirmMut    = trpc.scheduling.confirm.useMutation();
  const checkInMut    = trpc.scheduling.checkIn.useMutation();
  const startMut      = trpc.scheduling.start.useMutation();
  const completeMut   = trpc.scheduling.complete.useMutation();
  const cancelMut     = trpc.scheduling.cancel.useMutation();
  const rescheduleMut = trpc.scheduling.reschedule.useMutation();

  const scheduledAt = useMemo(
    () => appointment ? new Date(appointment.scheduledAt) : null,
    [appointment],
  );
  const endsAt = useMemo(
    () => appointment && scheduledAt
      ? new Date(scheduledAt.getTime() + appointment.durationMin * 60_000)
      : null,
    [appointment, scheduledAt],
  );

  /* ── Mutation helpers ─────────────────────────────────────────────────── */

  async function handleConfirm() {
    try {
      await confirmMut.mutateAsync({ id: appointment!.id, via: 'manual' });
      onMutated?.();
    } catch { /* toast on error could go here */ }
  }

  async function handleCheckIn() {
    try {
      await checkInMut.mutateAsync({ id: appointment!.id });
      onMutated?.();
    } catch { /* */ }
  }

  async function handleStart() {
    try {
      await startMut.mutateAsync({ id: appointment!.id });
      onMutated?.();
      onOpenChange(false);
      router.push(`/pacientes/${appointment!.patientId}/prontuario`);
    } catch { /* */ }
  }

  async function handleComplete() {
    try {
      await completeMut.mutateAsync({ id: appointment!.id });
      onMutated?.();
    } catch { /* */ }
  }

  async function handleCancelConfirm() {
    if (!cancelReason.trim()) return;
    try {
      await cancelMut.mutateAsync({ id: appointment!.id, reason: cancelReason });
      setCancelOpen(false);
      setCancelReason('');
      onOpenChange(false);
      onMutated?.();
    } catch { /* */ }
  }

  async function handleReschedule() {
    if (!rescheduleDate) return;
    try {
      await rescheduleMut.mutateAsync({
        id: appointment!.id,
        newScheduledAt: new Date(rescheduleDate),
      });
      setRescheduleOpen(false);
      onOpenChange(false);
      onMutated?.();
    } catch { /* */ }
  }

  /* ── Empty state ──────────────────────────────────────────────────────── */

  if (!appointment || !scheduledAt || !endsAt) {
    return (
      <SheetRoot open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Detalhes do agendamento</SheetTitle>
          </SheetHeader>
          <SheetBody>
            <p style={{ color: T.textMuted, fontSize: 13 }}>Selecione um agendamento.</p>
          </SheetBody>
        </SheetContent>
      </SheetRoot>
    );
  }

  const status = appointment.status;
  const variant = STATUS_VARIANT[status] ?? 'default';
  const label = STATUS_LABEL[status] ?? status;

  /* ── Cancel sub-dialog ────────────────────────────────────────────────── */
  const cancelDialog = cancelOpen && (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(3px)',
      }}
      onClick={() => { setCancelOpen(false); setCancelReason(''); }}
    >
      <Glass
        style={{
          width: 380,
          padding: 24,
          borderRadius: T.r.lg,
          background: '#fff',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary, marginBottom: 4 }}>
          Cancelar agendamento
        </p>
        <p style={{ fontSize: 12, color: T.textMuted, marginBottom: 14 }}>
          Informe o motivo do cancelamento. O paciente poderá ser notificado.
        </p>
        <textarea
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          placeholder="Ex: paciente pediu para remarcar"
          rows={3}
          aria-label="Motivo do cancelamento"
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: T.r.md,
            borderTop: `1px solid ${T.inputBorder}`,
            borderRight: `1px solid ${T.inputBorder}`,
            borderBottom: `1px solid ${T.inputBorder}`,
            borderLeft: `1px solid ${T.inputBorder}`,
            background: T.inputBg,
            fontSize: 13,
            fontFamily: "'IBM Plex Sans', sans-serif",
            color: T.textPrimary,
            outline: 'none',
            resize: 'vertical',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <Btn variant="ghost" small onClick={() => { setCancelOpen(false); setCancelReason(''); }}>
            Voltar
          </Btn>
          <Btn
            variant="danger"
            small
            onClick={handleCancelConfirm}
            disabled={!cancelReason.trim() || cancelMut.isPending}
          >
            {cancelMut.isPending ? 'Cancelando…' : 'Confirmar cancelamento'}
          </Btn>
        </div>
      </Glass>
    </div>
  );

  /* ── Reschedule sub-dialog ────────────────────────────────────────────── */
  const rescheduleDialog = rescheduleOpen && (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(3px)',
      }}
      onClick={() => setRescheduleOpen(false)}
    >
      <Glass
        style={{
          width: 360,
          padding: 24,
          borderRadius: T.r.lg,
          background: '#fff',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary, marginBottom: 4 }}>
          Remarcar agendamento
        </p>
        <p style={{ fontSize: 12, color: T.textMuted, marginBottom: 14 }}>
          Selecione a nova data e horário.
        </p>
        <input
          type="datetime-local"
          value={rescheduleDate}
          onChange={(e) => setRescheduleDate(e.target.value)}
          aria-label="Nova data e horário"
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: T.r.md,
            borderTop: `1px solid ${T.inputBorder}`,
            borderRight: `1px solid ${T.inputBorder}`,
            borderBottom: `1px solid ${T.inputBorder}`,
            borderLeft: `1px solid ${T.inputBorder}`,
            background: T.inputBg,
            fontSize: 13,
            fontFamily: "'IBM Plex Sans', sans-serif",
            color: T.textPrimary,
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <Btn variant="ghost" small onClick={() => setRescheduleOpen(false)}>
            Voltar
          </Btn>
          <Btn
            small
            onClick={handleReschedule}
            disabled={!rescheduleDate || rescheduleMut.isPending}
          >
            {rescheduleMut.isPending ? 'Remarcando…' : 'Remarcar'}
          </Btn>
        </div>
      </Glass>
    </div>
  );

  /* ── Detail rows ──────────────────────────────────────────────────────── */
  const detailRows: Array<{ label: string; value: string }> = [
    { label: 'Tipo', value: appointment.service?.name ?? appointment.type },
    { label: 'Duração', value: `${appointment.durationMin} min` },
    { label: 'Médico', value: appointment.provider.name },
    { label: 'Sala', value: appointment.room ?? '—' },
    { label: 'Origem', value: formatSource(appointment.source) },
  ];

  return (
    <>
      <SheetRoot open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right">
          {/* ── Header ──────────────────────────────────────────────── */}
          <div
            style={{
              padding: '20px 24px 16px',
              borderBottom: `1px solid ${T.divider}`,
              flexShrink: 0,
            }}
          >
            <SheetTitle style={{ fontSize: 17, fontWeight: 700, color: T.textPrimary, margin: 0 }}>
              Detalhes do agendamento
            </SheetTitle>
            <SheetDescription style={{ display: 'none' }}>
              Painel lateral com os detalhes do agendamento selecionado
            </SheetDescription>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <Badge variant={variant} dot>
                {label}
              </Badge>
              <Mono size={10} color={T.textMuted}>
                {format(scheduledAt, 'dd/MM/yyyy', { locale: ptBR })} • {formatSlotRange(scheduledAt, endsAt)}
              </Mono>
            </div>
          </div>

          {/* ── Body ────────────────────────────────────────────────── */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 22 }}>

            {/* Patient */}
            <section>
              <Mono size={8} spacing="1.2px" color={T.textMuted}>PACIENTE</Mono>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: T.clinical.bg,
                    borderTop: `1px solid ${T.clinical.border}`,
                    borderRight: `1px solid ${T.clinical.border}`,
                    borderBottom: `1px solid ${T.clinical.border}`,
                    borderLeft: `1px solid ${T.clinical.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    overflow: 'hidden',
                  }}
                >
                  {appointment.patient.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={appointment.patient.photoUrl}
                      alt={appointment.patient.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span style={{ fontSize: 14, fontWeight: 700, color: T.clinical.color }}>
                      {initials(appointment.patient.name)}
                    </span>
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: T.textPrimary,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {appointment.patient.name}
                  </p>
                  {appointment.patient.age !== null && (
                    <p style={{ fontSize: 12, color: T.textMuted, marginTop: 1 }}>
                      {appointment.patient.age} anos
                    </p>
                  )}
                </div>
              </div>

              {/* Allergy banner */}
              {appointment.patient.allergiesCount > 0 && (
                <div
                  role="alert"
                  style={{
                    marginTop: 10,
                    padding: '8px 12px',
                    borderRadius: T.r.md,
                    background: T.dangerBg,
                    borderTop: `1px solid ${T.dangerBorder}`,
                    borderRight: `1px solid ${T.dangerBorder}`,
                    borderBottom: `1px solid ${T.dangerBorder}`,
                    borderLeft: `3px solid ${T.danger}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Ico name="alert-triangle" size={14} color={T.danger} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.danger }}>
                    ALERGIAS: {appointment.patient.allergiesSummary}
                  </span>
                </div>
              )}
            </section>

            {/* Details */}
            <section>
              <Mono size={8} spacing="1.2px" color={T.textMuted}>DETALHES</Mono>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 0 }}>
                {detailRows.map((r) => (
                  <div
                    key={r.label}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '7px 0',
                      borderBottom: `1px solid ${T.divider}`,
                    }}
                  >
                    <span style={{ fontSize: 12, color: T.textMuted }}>{r.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: T.textPrimary }}>{r.value}</span>
                  </div>
                ))}
              </div>

              {appointment.patientNotes && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>Observações do paciente</p>
                  <p style={{ fontSize: 13, color: T.textPrimary, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {appointment.patientNotes}
                  </p>
                </div>
              )}
              {appointment.internalNotes && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>Notas internas</p>
                  <p style={{ fontSize: 13, color: T.textPrimary, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {appointment.internalNotes}
                  </p>
                </div>
              )}
            </section>

            {/* Timeline / History */}
            {appointment.statusHistory.length > 0 && (
              <section>
                <Mono size={8} spacing="1.2px" color={T.textMuted}>HISTÓRICO</Mono>
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {appointment.statusHistory.map((h, i) => {
                    const hLabel = STATUS_LABEL[h.status] ?? h.status;
                    const hVariant = STATUS_VARIANT[h.status] ?? 'default';
                    const isLast = i === appointment.statusHistory.length - 1;
                    return (
                      <div
                        key={`${h.changed_at}-${h.status}`}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 12,
                          paddingBottom: isLast ? 0 : 12,
                          position: 'relative',
                        }}
                      >
                        {/* Dot + connector line */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                          <div
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: T.primary,
                              marginTop: 4,
                            }}
                          />
                          {!isLast && (
                            <div
                              style={{
                                width: 1,
                                flex: 1,
                                minHeight: 16,
                                background: T.divider,
                                marginTop: 4,
                              }}
                            />
                          )}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>
                              {hLabel}
                            </span>
                          </div>
                          <Mono size={9} color={T.textMuted}>
                            {formatTs(h.changed_at)}
                          </Mono>
                          {(h.reason || h.via) && (
                            <p style={{ fontSize: 11, color: T.textTertiary, marginTop: 2 }}>
                              {h.reason ?? h.via}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          {/* ── Footer ──────────────────────────────────────────────── */}
          <div
            style={{
              padding: '14px 24px',
              borderTop: `1px solid ${T.divider}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0,
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <Link
              href={`/pacientes/${appointment.patient.id}/perfil`}
              style={{
                fontSize: 12,
                color: T.primary,
                textDecoration: 'underline',
                textUnderlineOffset: 2,
              }}
            >
              Ver perfil do paciente
            </Link>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {status === 'scheduled' && (
                <>
                  <Btn variant="ghost" small onClick={() => setCancelOpen(true)}>
                    Cancelar
                  </Btn>
                  <Btn small onClick={handleConfirm} loading={confirmMut.isPending} icon="check">
                    Confirmar
                  </Btn>
                </>
              )}
              {status === 'confirmed' && (
                <>
                  <Btn variant="ghost" small onClick={() => setRescheduleOpen(true)} icon="calendar">
                    Remarcar
                  </Btn>
                  <Btn variant="danger" small onClick={() => setCancelOpen(true)}>
                    Cancelar
                  </Btn>
                  <Btn small onClick={handleCheckIn} loading={checkInMut.isPending} icon="user-check">
                    Check-in
                  </Btn>
                </>
              )}
              {(status === 'waiting' || status === 'checked_in') && (
                <Btn small onClick={handleStart} loading={startMut.isPending} icon="play">
                  Iniciar Atendimento
                </Btn>
              )}
              {status === 'in_progress' && (
                <Btn small onClick={handleComplete} loading={completeMut.isPending} icon="check">
                  Concluir
                </Btn>
              )}
              {status === 'completed' && (
                <Btn small onClick={() => router.push(`/pacientes/${appointment.patient.id}/prontuario`)} icon="file-text">
                  Ver Prontuário
                </Btn>
              )}
            </div>
          </div>
        </SheetContent>
      </SheetRoot>

      {cancelDialog}
      {rescheduleDialog}
    </>
  );
}
