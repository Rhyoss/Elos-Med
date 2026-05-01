'use client';

import * as React from 'react';
import { Badge, Bar, Btn, Glass, Ico, Mono, Skeleton, T } from '@dermaos/ui/ds';
import { PROTOCOL_TYPE_LABELS, PROTOCOL_STATUS_LABELS, type ProtocolStatus } from '@dermaos/shared';
import { useProtocol, useProtocolSessions, useSuggestNextSession, usePauseProtocol, useResumeProtocol, useCancelProtocol } from '@/lib/hooks/use-procedures';
import { RegisterSessionDialog } from './register-session-dialog';

interface ProtocolDetailProps {
  protocolId: string;
  patientId: string;
  onBack: () => void;
  onScheduleSession?: (suggestedAt: Date) => void;
}

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  ativo: 'success', pausado: 'warning', concluido: 'default', cancelado: 'danger',
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

export function ProtocolDetail({ protocolId, patientId, onBack, onScheduleSession }: ProtocolDetailProps) {
  const { protocol, isLoading } = useProtocol(protocolId);
  const sessionsQ = useProtocolSessions(protocolId);
  const suggestQ = useSuggestNextSession(protocolId);
  const pauseMut = usePauseProtocol(patientId);
  const resumeMut = useResumeProtocol(patientId);
  const cancelMut = useCancelProtocol(patientId);

  const [showRegister, setShowRegister] = React.useState(false);
  const [actionReason, setActionReason] = React.useState('');
  const [showPause, setShowPause] = React.useState(false);
  const [showCancel, setShowCancel] = React.useState(false);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Skeleton height={200} />
        <Skeleton height={100} />
        <Skeleton height={100} />
      </div>
    );
  }

  if (!protocol) {
    return (
      <div>
        <Btn variant="ghost" small icon="arrowLeft" onClick={onBack}>Voltar</Btn>
        <p style={{ marginTop: 16, color: T.textMuted }}>Protocolo não encontrado.</p>
      </div>
    );
  }

  const sessions = sessionsQ.data?.sessions ?? [];
  const pct = (protocol.sessionsDone / Math.max(1, protocol.totalSessions)) * 100;
  const isActive = protocol.status === 'ativo';
  const isPaused = protocol.status === 'pausado';
  const suggestion = suggestQ.data;

  async function handlePause() {
    if (actionReason.trim().length < 3) return;
    await pauseMut.mutateAsync({ id: protocolId, reason: actionReason.trim() });
    setShowPause(false);
    setActionReason('');
  }

  async function handleCancel() {
    if (actionReason.trim().length < 3) return;
    await cancelMut.mutateAsync({ id: protocolId, reason: actionReason.trim() });
    setShowCancel(false);
    setActionReason('');
  }

  async function handleResume() {
    await resumeMut.mutateAsync({ id: protocolId });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Back + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Btn variant="ghost" small icon="arrowLeft" onClick={onBack}>Voltar</Btn>
      </div>

      {/* Protocol header */}
      <Glass style={{ padding: '20px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <p style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary }}>{protocol.name}</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
              <Mono size={10} color={T.textMuted}>
                {PROTOCOL_TYPE_LABELS[protocol.type as keyof typeof PROTOCOL_TYPE_LABELS] ?? protocol.type}
              </Mono>
              <span style={{ color: T.textMuted }}>·</span>
              <Mono size={10} color={T.textMuted}>
                {protocol.id.slice(0, 8).toUpperCase()}
              </Mono>
            </div>
          </div>
          <Badge variant={STATUS_VARIANT[protocol.status] ?? 'default'}>
            {PROTOCOL_STATUS_LABELS[protocol.status as ProtocolStatus] ?? protocol.status}
          </Badge>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 14 }}>
          <StatCard label="SESSÕES" value={`${protocol.sessionsDone}/${protocol.totalSessions}`} />
          <StatCard label="INÍCIO" value={formatDate(protocol.startedAt)} color={T.primary} />
          {protocol.intervalDays && (
            <StatCard label="INTERVALO" value={`${protocol.intervalDays} dias`} />
          )}
          {protocol.expectedEndDate && (
            <StatCard label="PREVISÃO" value={formatDate(protocol.expectedEndDate)} color={T.primary} />
          )}
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Bar pct={pct} color={T.clinical.color} height={8} />
          </div>
          <Mono size={12} color={T.clinical.color}>{Math.round(pct)}%</Mono>
        </div>

        {protocol.description && (
          <p style={{ fontSize: 13, color: T.textSecondary, marginTop: 12, lineHeight: 1.5 }}>
            {protocol.description}
          </p>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          {isActive && (
            <>
              <Btn small icon="check" onClick={() => setShowRegister(true)}>
                Registrar Sessão
              </Btn>
              {suggestion?.suggestedAt && onScheduleSession && (
                <Btn variant="glass" small icon="calendar" onClick={() => onScheduleSession(suggestion.suggestedAt!)}>
                  Agendar Próxima ({formatDate(suggestion.suggestedAt)})
                </Btn>
              )}
              <Btn variant="ghost" small icon="clock" onClick={() => setShowPause(true)}>
                Pausar
              </Btn>
              <Btn variant="ghost" small icon="x" onClick={() => setShowCancel(true)} style={{ color: T.danger }}>
                Cancelar
              </Btn>
            </>
          )}
          {isPaused && (
            <Btn small icon="zap" onClick={handleResume} disabled={resumeMut.isPending}>
              {resumeMut.isPending ? 'Retomando…' : 'Retomar Protocolo'}
            </Btn>
          )}
        </div>
      </Glass>

      {/* Next session suggestion */}
      {isActive && suggestion?.suggestedAt && (
        <Glass style={{ padding: '12px 16px', borderLeft: `3px solid ${T.primary}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Ico name="calendar" size={16} color={T.primary} />
            <p style={{ fontSize: 13, color: T.textPrimary }}>
              <strong>Próxima sessão sugerida:</strong> {formatDate(suggestion.suggestedAt)}
            </p>
          </div>
        </Glass>
      )}

      {/* Sessions list */}
      <div>
        <Mono size={11} spacing="1.2px" color={T.primary} style={{ marginBottom: 10 }}>
          {sessions.length} {sessions.length === 1 ? 'SESSÃO REGISTRADA' : 'SESSÕES REGISTRADAS'}
        </Mono>

        {sessionsQ.isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} height={80} delay={i * 80} />
            ))}
          </div>
        )}

        {sessions.length === 0 && !sessionsQ.isLoading && (
          <Glass style={{ padding: '20px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: T.textMuted }}>
              Nenhuma sessão registrada ainda.
            </p>
          </Glass>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sessions.map((s, idx) => (
            <Glass key={s.id} style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: T.clinical.bg, border: `2px solid ${T.clinical.color}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: T.clinical.color,
                  }}>
                    {idx + 1}
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
                    Sessão {idx + 1}
                  </p>
                </div>
                <Mono size={10} color={T.textMuted}>
                  {formatDateTime(s.performedAt)}
                </Mono>
              </div>

              {s.durationMin && (
                <Mono size={10} color={T.textMuted}>
                  Duração: {s.durationMin} min
                </Mono>
              )}

              {s.outcome && (
                <p style={{ fontSize: 13, color: T.textSecondary, marginTop: 6, lineHeight: 1.5 }}>
                  {s.outcome}
                </p>
              )}

              {s.adverseEvents && s.adverseEvents.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {s.adverseEvents.map((ae, aIdx) => (
                    <Badge key={aIdx} variant={ae.severity === 'grave' ? 'danger' : 'warning'} dot={false}>
                      {ae.description} ({ae.severity})
                    </Badge>
                  ))}
                </div>
              )}

              {s.productsConsumed && s.productsConsumed.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <Mono size={9} color={T.textMuted}>PRODUTOS CONSUMIDOS</Mono>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {s.productsConsumed.map((pc, pcIdx) => (
                      <span key={pcIdx} style={{
                        padding: '3px 8px', borderRadius: T.r.sm,
                        background: T.supply.bg, border: `1px solid ${T.supply.border}`,
                        fontSize: 11, color: T.supply.color,
                      }}>
                        {pc.productId.slice(0, 8)} × {pc.quantity}
                        {pc.lotId && ` (lote ${pc.lotId.slice(0, 6)})`}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Glass>
          ))}
        </div>
      </div>

      {/* Pause dialog */}
      {showPause && (
        <ReasonDialog
          title="Pausar Protocolo"
          description="Informe o motivo da pausa. O protocolo poderá ser retomado posteriormente."
          reason={actionReason}
          onReasonChange={setActionReason}
          onConfirm={handlePause}
          onCancel={() => { setShowPause(false); setActionReason(''); }}
          confirmLabel={pauseMut.isPending ? 'Pausando…' : 'Pausar'}
          isLoading={pauseMut.isPending}
          confirmVariant="warning"
        />
      )}

      {/* Cancel dialog */}
      {showCancel && (
        <ReasonDialog
          title="Cancelar Protocolo"
          description="Esta ação é irreversível. Informe o motivo do cancelamento."
          reason={actionReason}
          onReasonChange={setActionReason}
          onConfirm={handleCancel}
          onCancel={() => { setShowCancel(false); setActionReason(''); }}
          confirmLabel={cancelMut.isPending ? 'Cancelando…' : 'Cancelar Protocolo'}
          isLoading={cancelMut.isPending}
          confirmVariant="danger"
        />
      )}

      {/* Register session dialog */}
      <RegisterSessionDialog
        patientId={patientId}
        protocolId={protocolId}
        protocolName={protocol.name}
        sessionNumber={protocol.sessionsDone + 1}
        totalSessions={protocol.totalSessions}
        open={showRegister}
        onClose={() => setShowRegister(false)}
        onRegistered={() => {
          void sessionsQ.refetch();
        }}
      />
    </div>
  );
}

/* ── Stat card ─────────────────────────────────────────────────────────── */

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: T.r.md,
      background: T.glass, border: `1px solid ${T.glassBorder}`,
      textAlign: 'center',
    }}>
      <Mono size={9}>{label}</Mono>
      <p style={{ fontSize: 15, fontWeight: 600, color: color ?? T.textPrimary, marginTop: 3 }}>
        {value}
      </p>
    </div>
  );
}

/* ── Reason dialog for pause/cancel ────────────────────────────────────── */

function ReasonDialog({
  title,
  description,
  reason,
  onReasonChange,
  onConfirm,
  onCancel,
  confirmLabel,
  isLoading,
  confirmVariant,
}: {
  title: string;
  description: string;
  reason: string;
  onReasonChange: (r: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel: string;
  isLoading: boolean;
  confirmVariant: 'warning' | 'danger';
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{
        width: '100%', maxWidth: 420, background: '#fff',
        borderRadius: T.r.xl, boxShadow: T.shadow.xl, padding: 20,
      }}>
        <p style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary, marginBottom: 6 }}>
          {title}
        </p>
        <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 14 }}>
          {description}
        </p>
        <textarea
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="Motivo (mínimo 3 caracteres)…"
          rows={3}
          autoFocus
          style={{
            width: '100%', padding: '10px 12px', borderRadius: T.r.md,
            border: `1px solid ${T.inputBorder}`, background: T.inputBg,
            fontSize: 14, fontFamily: "'IBM Plex Sans', sans-serif",
            resize: 'vertical', color: T.textPrimary, marginBottom: 14,
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn variant="ghost" small onClick={onCancel}>Voltar</Btn>
          <Btn
            small
            onClick={onConfirm}
            disabled={reason.trim().length < 3 || isLoading}
            style={{
              background: confirmVariant === 'danger' ? T.danger : T.warning,
              color: '#fff',
            }}
          >
            {confirmLabel}
          </Btn>
        </div>
      </div>
    </div>
  );
}
