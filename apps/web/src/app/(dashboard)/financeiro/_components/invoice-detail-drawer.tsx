'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@dermaos/ui';
import { Btn, Ico, T, Mono, Badge, Skeleton } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import type { InvoiceStatus } from '@dermaos/shared';
import { ModalShell } from './modal-shell';
import { RegisterPaymentModal } from './register-payment-modal';
import {
  fmtBRLFull,
  fmtFullDate,
  fmtDateTime,
  STATUS_BADGE,
  statusLabel,
  methodLabel,
} from '../_lib/format';

interface InvoiceDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  invoiceId: string | null;
  canWrite: boolean;
}

export function InvoiceDetailDrawer({
  open,
  onClose,
  invoiceId,
  canWrite,
}: InvoiceDetailDrawerProps) {
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const invoiceQ = trpc.financial.invoices.getById.useQuery(
    { id: invoiceId! },
    { enabled: open && !!invoiceId },
  );
  const itemsQ = trpc.financial.invoices.items.useQuery(
    { invoiceId: invoiceId! },
    { enabled: open && !!invoiceId },
  );
  const paymentsQ = trpc.financial.payments.forInvoice.useQuery(
    { invoiceId: invoiceId! },
    { enabled: open && !!invoiceId },
  );

  const [paymentOpen, setPaymentOpen] = React.useState(false);
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const [cancelReason, setCancelReason]   = React.useState('');

  const emitMutation = trpc.financial.invoices.emit.useMutation({
    onSuccess: () => {
      void utils.financial.invoices.list.invalidate();
      void utils.financial.invoices.getById.invalidate({ id: invoiceId! });
      toast.success('Fatura emitida', {
        description: 'Número sequencial atribuído.',
      });
    },
    onError: (err) => toast.error('Erro ao emitir', { description: err.message }),
  });

  const cancelMutation = trpc.financial.invoices.cancel.useMutation({
    onSuccess: () => {
      void utils.financial.invoices.list.invalidate();
      void utils.financial.invoices.getById.invalidate({ id: invoiceId! });
      toast.success('Fatura cancelada');
      setConfirmCancel(false);
      onClose();
    },
    onError: (err) => toast.error('Erro ao cancelar', { description: err.message }),
  });

  const refundMutation = trpc.financial.payments.refund.useMutation({
    onSuccess: () => {
      void utils.financial.invoices.list.invalidate();
      void utils.financial.invoices.getById.invalidate({ id: invoiceId! });
      void utils.financial.payments.forInvoice.invalidate({ invoiceId: invoiceId! });
      void utils.financial.caixa.getDia.invalidate();
      toast.success('Pagamento estornado');
    },
    onError: (err) => toast.error('Erro ao estornar', { description: err.message }),
  });

  const inv = invoiceQ.data;
  const items = itemsQ.data ?? [];
  const payments = paymentsQ.data ?? [];

  if (!open) return null;

  const status = (inv?.status ?? 'rascunho') as InvoiceStatus;
  const amountDue = inv ? Math.max(0, inv.total_amount - inv.amount_paid) : 0;
  const canEmit = canWrite && status === 'rascunho';
  const canPay  = canWrite && ['emitida', 'parcial', 'vencida'].includes(status);
  const canCancel = canWrite && !['paga', 'cancelada'].includes(status);

  return (
    <>
      <ModalShell
        open={open}
        onClose={onClose}
        title={inv?.invoice_number ?? 'Fatura'}
        subtitle={inv?.patient_name ?? 'Carregando…'}
        icon="creditCard"
        iconTone="financial"
        drawer
        width={580}
        footer={
          <>
            {canEmit && (
              <Btn
                small
                icon="check"
                loading={emitMutation.isPending}
                onClick={() => emitMutation.mutate({ id: inv!.id })}
              >
                Emitir
              </Btn>
            )}
            {canPay && (
              <Btn
                small
                variant="primary"
                icon="creditCard"
                onClick={() => setPaymentOpen(true)}
              >
                Registrar pagamento
              </Btn>
            )}
            {inv?.patient_id && (
              <Btn
                small
                variant="glass"
                icon="user"
                onClick={() => {
                  router.push(`/pacientes/${inv.patient_id}/prontuario`);
                  onClose();
                }}
              >
                Prontuário
              </Btn>
            )}
            <div style={{ flex: 1 }} />
            {canCancel && (
              <Btn
                small
                variant="danger"
                icon="x"
                onClick={() => setConfirmCancel(true)}
              >
                Cancelar
              </Btn>
            )}
            <Btn small variant="ghost" onClick={onClose}>
              Fechar
            </Btn>
          </>
        }
      >
        {invoiceQ.isLoading || !inv ? (
          <DetailSkeleton />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Status + totals header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
              }}
            >
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: T.r.md,
                  background: T.metalGrad,
                  border: `1px solid ${T.divider}`,
                }}
              >
                <Mono size={10} color={T.textMuted} spacing="0.8px">
                  STATUS
                </Mono>
                <div style={{ marginTop: 6 }}>
                  <Badge variant={STATUS_BADGE[status]}>{statusLabel(status)}</Badge>
                </div>
                <p style={{ fontSize: 11, color: T.textMuted, marginTop: 8 }}>
                  Emitida em {fmtFullDate(inv.issue_date)}
                  {inv.due_date && ` · Vence em ${fmtFullDate(inv.due_date)}`}
                </p>
              </div>
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: T.r.md,
                  background: T.financial.bg,
                  border: `1px solid ${T.financial.border}`,
                }}
              >
                <Mono size={10} color={T.financial.color} spacing="0.8px">
                  TOTAL DA FATURA
                </Mono>
                <p
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: T.textPrimary,
                    marginTop: 4,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {fmtBRLFull(inv.total_amount)}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: T.textSecondary }}>
                    Pago: {fmtBRLFull(inv.amount_paid)}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: amountDue > 0 ? T.danger : T.success,
                    }}
                  >
                    Saldo: {fmtBRLFull(amountDue)}
                  </span>
                </div>
              </div>
            </div>

            {/* Items */}
            <Section title="Itens" icon="layers">
              {items.length === 0 ? (
                <p style={{ fontSize: 12, color: T.textMuted, padding: '12px 0' }}>
                  Nenhum item.
                </p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Descrição', 'Qtd', 'Unitário', 'Total'].map((h, i) => (
                        <th
                          key={h}
                          style={{
                            padding: '8px 0',
                            textAlign: i === 0 ? 'left' : 'right',
                            fontSize: 10,
                            fontFamily: "'IBM Plex Mono', monospace",
                            color: T.textMuted,
                            fontWeight: 500,
                            letterSpacing: '0.5px',
                            borderBottom: `1px solid ${T.divider}`,
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.id} style={{ borderBottom: `1px solid ${T.divider}` }}>
                        <td style={{ padding: '10px 0', fontSize: 13, color: T.textPrimary }}>
                          {it.description}
                        </td>
                        <td
                          style={{
                            padding: '10px 0',
                            fontSize: 13,
                            color: T.textSecondary,
                            textAlign: 'right',
                          }}
                        >
                          ×{it.quantity}
                        </td>
                        <td
                          style={{
                            padding: '10px 0',
                            fontSize: 12,
                            color: T.textSecondary,
                            textAlign: 'right',
                            fontFamily: "'IBM Plex Mono', monospace",
                          }}
                        >
                          {fmtBRLFull(it.unit_price)}
                        </td>
                        <td
                          style={{
                            padding: '10px 0',
                            fontSize: 13,
                            fontWeight: 600,
                            color: T.textPrimary,
                            textAlign: 'right',
                          }}
                        >
                          {fmtBRLFull(it.total_price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 4,
                  paddingTop: 12,
                  borderTop: `2px solid ${T.divider}`,
                  marginTop: 4,
                }}
              >
                <span style={{ fontSize: 12, color: T.textSecondary }}>Subtotal</span>
                <span
                  style={{
                    fontSize: 13,
                    color: T.textPrimary,
                    textAlign: 'right',
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}
                >
                  {fmtBRLFull(inv.subtotal)}
                </span>
                {inv.discount_amount > 0 && (
                  <>
                    <span style={{ fontSize: 12, color: T.warning }}>
                      Desconto
                      {inv.discount_reason && ` (${inv.discount_reason})`}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        color: T.warning,
                        fontWeight: 600,
                        textAlign: 'right',
                      }}
                    >
                      – {fmtBRLFull(inv.discount_amount)}
                    </span>
                  </>
                )}
                <span style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, marginTop: 4 }}>
                  Total
                </span>
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: T.financial.color,
                    textAlign: 'right',
                    marginTop: 4,
                  }}
                >
                  {fmtBRLFull(inv.total_amount)}
                </span>
              </div>
            </Section>

            {/* Payments */}
            <Section title="Pagamentos" icon="creditCard">
              {paymentsQ.isLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Skeleton width="100%" height={42} />
                  <Skeleton width="100%" height={42} />
                </div>
              ) : payments.length === 0 ? (
                <p style={{ fontSize: 12, color: T.textMuted, padding: '12px 0' }}>
                  Nenhum pagamento registrado.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {payments.map((p) => {
                    const refunded = p.payment_type === 'estorno' || p.status === 'estornado';
                    return (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 12px',
                          borderRadius: T.r.md,
                          background: refunded ? T.dangerBg : 'white',
                          border: `1px solid ${refunded ? T.dangerBorder : T.divider}`,
                        }}
                      >
                        <Ico
                          name={refunded ? 'arrowLeft' : 'check'}
                          size={14}
                          color={refunded ? T.danger : T.success}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>
                            {methodLabel(p.method)}
                            {p.card_installments && p.card_installments > 1
                              ? ` · ${p.card_installments}x`
                              : ''}
                            {p.pix_txid && (
                              <span
                                style={{
                                  marginLeft: 8,
                                  fontFamily: "'IBM Plex Mono', monospace",
                                  fontSize: 10,
                                  color: T.textMuted,
                                  fontWeight: 400,
                                }}
                              >
                                {p.pix_txid.slice(0, 12)}…
                              </span>
                            )}
                          </p>
                          <p style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>
                            {fmtDateTime(p.received_at ?? p.created_at)}
                            {refunded && ' · ESTORNADO'}
                          </p>
                        </div>
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: refunded ? T.danger : T.textPrimary,
                            textDecoration: refunded ? 'line-through' : undefined,
                          }}
                        >
                          {fmtBRLFull(p.amount)}
                        </span>
                        {!refunded && canWrite && p.payment_type === 'pagamento' && (
                          <button
                            type="button"
                            onClick={() => {
                              const reason = window.prompt(
                                'Motivo do estorno (mín. 5 caracteres):',
                              );
                              if (!reason || reason.length < 5) return;
                              refundMutation.mutate({ paymentId: p.id, reason });
                            }}
                            aria-label="Estornar pagamento"
                            title="Estornar"
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 4,
                              borderRadius: T.r.sm,
                              display: 'flex',
                            }}
                          >
                            <Ico name="arrowLeft" size={12} color={T.textMuted} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>

            {(inv.notes || inv.internal_notes) && (
              <Section title="Observações" icon="file">
                {inv.notes && (
                  <p style={{ fontSize: 13, color: T.textPrimary, lineHeight: 1.5 }}>
                    {inv.notes}
                  </p>
                )}
                {inv.internal_notes && (
                  <p
                    style={{
                      fontSize: 12,
                      color: T.textMuted,
                      lineHeight: 1.5,
                      marginTop: 8,
                      padding: '8px 12px',
                      borderRadius: T.r.sm,
                      background: T.metalGrad,
                      borderLeft: `3px solid ${T.warning}`,
                    }}
                  >
                    <strong style={{ color: T.warning }}>Interno: </strong>
                    {inv.internal_notes}
                  </p>
                )}
              </Section>
            )}
          </div>
        )}
      </ModalShell>

      {inv && (
        <RegisterPaymentModal
          open={paymentOpen}
          onClose={() => setPaymentOpen(false)}
          invoiceId={inv.id}
          invoiceNumber={inv.invoice_number}
          amountDue={amountDue}
          patientName={inv.patient_name}
        />
      )}

      {/* Cancel confirmation */}
      <ModalShell
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Cancelar fatura"
        subtitle="Esta ação é irreversível e fica registrada no log de auditoria."
        icon="alert"
        iconTone="danger"
        width={460}
        footer={
          <>
            <Btn
              small
              variant="danger"
              icon="x"
              loading={cancelMutation.isPending}
              disabled={cancelReason.trim().length < 5}
              onClick={() =>
                cancelMutation.mutate({ id: inv!.id, reason: cancelReason.trim() })
              }
            >
              Confirmar cancelamento
            </Btn>
            <div style={{ flex: 1 }} />
            <Btn
              small
              variant="ghost"
              onClick={() => setConfirmCancel(false)}
            >
              Voltar
            </Btn>
          </>
        }
      >
        <p style={{ fontSize: 13, color: T.textSecondary, marginBottom: 12 }}>
          Informe o motivo do cancelamento (mínimo 5 caracteres).
        </p>
        <textarea
          rows={3}
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          placeholder="Ex.: paciente desistiu do procedimento"
          style={{
            width: '100%',
            padding: 10,
            borderRadius: T.r.md,
            border: `1px solid ${T.inputBorder}`,
            fontSize: 13,
            fontFamily: "'IBM Plex Sans', sans-serif",
            resize: 'vertical',
          }}
        />
      </ModalShell>
    </>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ComponentProps<typeof Ico>['name'];
  children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Ico name={icon} size={12} color={T.textMuted} />
        <Mono size={10} color={T.textMuted} spacing="0.8px">
          {title.toUpperCase()}
        </Mono>
      </div>
      {children}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Skeleton width="100%" height={70} />
      <Skeleton width="40%" height={14} />
      <Skeleton width="100%" height={120} />
      <Skeleton width="40%" height={14} />
      <Skeleton width="100%" height={80} />
    </div>
  );
}
