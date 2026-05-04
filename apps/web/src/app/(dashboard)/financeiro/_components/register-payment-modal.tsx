'use client';

import * as React from 'react';
import { useToast } from '@dermaos/ui';
import { Btn, Ico, T, Field, Mono, Badge } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
} from '@dermaos/shared';
import { ModalShell, ModalActions } from './modal-shell';
import {
  fmtBRLFull,
  parseCurrencyInput,
  maskCurrencyInput,
  METHOD_DESCRIPTION,
  METHOD_ICON,
} from '../_lib/format';

interface RegisterPaymentModalProps {
  open: boolean;
  onClose: () => void;
  invoiceId: string;
  invoiceNumber: string;
  amountDue: number;
  patientName: string | null;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 13px',
  borderRadius: T.r.md,
  background: T.inputBg,
  border: `1px solid ${T.inputBorder}`,
  fontSize: 14,
  color: T.textPrimary,
  fontFamily: "'IBM Plex Sans', sans-serif",
  outline: 'none',
};

export function RegisterPaymentModal({
  open,
  onClose,
  invoiceId,
  invoiceNumber,
  amountDue,
  patientName,
}: RegisterPaymentModalProps) {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [method, setMethod] = React.useState<PaymentMethod>('pix');
  const [amount, setAmount] = React.useState<number>(amountDue);
  const [paidAt, setPaidAt] = React.useState<string>(
    new Date().toISOString().slice(0, 16),
  );
  const [notes, setNotes] = React.useState<string>('');

  // Method-specific fields
  const [pixTxid, setPixTxid] = React.useState<string>('');
  const [cardBrand, setCardBrand] = React.useState<string>('');
  const [cardLast4, setCardLast4] = React.useState<string>('');
  const [cardInstallments, setCardInstallments] = React.useState<number>(1);
  const [boletoBarcode, setBoletoBarcode] = React.useState<string>('');
  const [convenioName, setConvenioName] = React.useState<string>('');
  const [convenioGuide, setConvenioGuide] = React.useState<string>('');

  const [errors, setErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (open) {
      setMethod('pix');
      setAmount(amountDue);
      setPaidAt(new Date().toISOString().slice(0, 16));
      setNotes('');
      setPixTxid('');
      setCardBrand('');
      setCardLast4('');
      setCardInstallments(1);
      setBoletoBarcode('');
      setConvenioName('');
      setConvenioGuide('');
      setErrors({});
    }
  }, [open, amountDue]);

  const mutation = trpc.financial.payments.register.useMutation({
    onSuccess: () => {
      void utils.financial.invoices.list.invalidate();
      void utils.financial.invoices.getById.invalidate({ id: invoiceId });
      void utils.financial.payments.forInvoice.invalidate({ invoiceId });
      void utils.financial.caixa.getDia.invalidate();
      void utils.analytics.financial.invalidate();
      toast.success('Pagamento registrado', {
        description: `${PAYMENT_METHOD_LABELS[method]} · ${fmtBRLFull(amount)}`,
      });
      onClose();
    },
    onError: (err) => {
      toast.error('Erro ao registrar pagamento', { description: err.message });
    },
  });

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (amount <= 0) next.amount = 'Valor deve ser maior que zero.';
    if (amount > amountDue) next.amount = `Valor excede o saldo (${fmtBRLFull(amountDue)}).`;
    if (method === 'cartao_credito' && cardLast4 && !/^\d{4}$/.test(cardLast4)) {
      next.cardLast4 = 'Use 4 dígitos.';
    }
    if (method === 'cartao_debito' && cardLast4 && !/^\d{4}$/.test(cardLast4)) {
      next.cardLast4 = 'Use 4 dígitos.';
    }
    if (method === 'plano_saude' && !convenioName.trim()) {
      next.convenio = 'Nome do convênio obrigatório.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    const base = {
      invoiceId,
      amount,
      paidAt: paidAt ? new Date(paidAt) : undefined,
      notes:  notes || undefined,
    };
    let payload: Parameters<typeof mutation.mutateAsync>[0];
    switch (method) {
      case 'dinheiro':
        payload = { ...base, method: 'dinheiro' };
        break;
      case 'pix':
        payload = { ...base, method: 'pix', pixTxid: pixTxid || undefined };
        break;
      case 'cartao_credito':
        payload = {
          ...base,
          method: 'cartao_credito',
          cardBrand: cardBrand || undefined,
          cardLast4: cardLast4 || undefined,
          cardInstallments,
        };
        break;
      case 'cartao_debito':
        payload = {
          ...base,
          method: 'cartao_debito',
          cardBrand: cardBrand || undefined,
          cardLast4: cardLast4 || undefined,
        };
        break;
      case 'boleto':
        payload = {
          ...base,
          method: 'boleto',
          boletoBarcode: boletoBarcode || undefined,
        };
        break;
      case 'plano_saude':
        payload = {
          ...base,
          method: 'plano_saude',
          convenioName,
          convenioGuide: convenioGuide || undefined,
        };
        break;
    }
    await mutation.mutateAsync(payload);
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Registrar pagamento"
      subtitle={`${invoiceNumber}${patientName ? ' · ' + patientName : ''}`}
      icon="creditCard"
      iconTone="success"
      width={580}
      footer={
        <ModalActions onCancel={onClose} busy={mutation.isPending}>
          <Btn
            small
            icon="check"
            loading={mutation.isPending}
            onClick={handleSubmit}
          >
            Confirmar pagamento
          </Btn>
        </ModalActions>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '12px 14px',
            borderRadius: T.r.md,
            background: T.metalGrad,
            border: `1px solid ${T.divider}`,
          }}
        >
          <Mono size={11} color={T.textMuted}>SALDO DEVEDOR</Mono>
          <span style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>
            {fmtBRLFull(amountDue)}
          </span>
        </div>

        <div>
          <span
            style={{
              fontSize: 11,
              color: T.textSecondary,
              fontWeight: 500,
              fontFamily: "'IBM Plex Sans', sans-serif",
            }}
          >
            MÉTODO DE PAGAMENTO
          </span>
          <div
            style={{
              marginTop: 8,
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
            }}
          >
            {PAYMENT_METHODS.map((m) => {
              const active = m === method;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  style={{
                    padding: '12px 10px',
                    borderRadius: T.r.md,
                    border: `1px solid ${active ? T.financial.border : T.divider}`,
                    background: active ? T.financial.bg : 'white',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: "'IBM Plex Sans', sans-serif",
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Ico
                      name={METHOD_ICON[m]}
                      size={14}
                      color={active ? T.financial.color : T.textMuted}
                    />
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: active ? T.financial.color : T.textPrimary,
                      }}
                    >
                      {PAYMENT_METHOD_LABELS[m]}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          <p
            style={{
              marginTop: 8,
              fontSize: 11,
              color: T.textMuted,
              fontStyle: 'italic',
            }}
          >
            {METHOD_DESCRIPTION[method]}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Valor recebido (R$)" required error={errors.amount} icon="creditCard">
            <input
              type="text"
              inputMode="decimal"
              value={maskCurrencyInput(amount)}
              onChange={(e) => setAmount(parseCurrencyInput(e.target.value))}
              style={{ ...inputStyle, fontWeight: 600 }}
            />
          </Field>
          <Field label="Data e hora do pagamento" icon="clock">
            <input
              type="datetime-local"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              style={inputStyle}
            />
          </Field>
        </div>

        {amount > 0 && amount < amountDue && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: T.r.md,
              background: T.warningBg,
              border: `1px solid ${T.warningBorder}`,
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
            }}
          >
            <Ico name="alert" size={14} color={T.warning} />
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: T.warning }}>
                Pagamento parcial
              </p>
              <p style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>
                Restará {fmtBRLFull(amountDue - amount)} em aberto. A fatura será marcada como{' '}
                <Badge variant="warning">parcial</Badge>.
              </p>
            </div>
          </div>
        )}

        {/* Method-specific fields */}
        {method === 'pix' && (
          <Field label="ID da transação PIX (opcional)" icon="hash">
            <input
              type="text"
              value={pixTxid}
              onChange={(e) => setPixTxid(e.target.value)}
              placeholder="EXX12345..."
              style={inputStyle}
            />
          </Field>
        )}

        {(method === 'cartao_credito' || method === 'cartao_debito') && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 0.8fr', gap: 12 }}>
            <Field label="Bandeira (opcional)">
              <select
                value={cardBrand}
                onChange={(e) => setCardBrand(e.target.value)}
                style={inputStyle}
              >
                <option value="">— Selecione —</option>
                <option value="Visa">Visa</option>
                <option value="Mastercard">Mastercard</option>
                <option value="Elo">Elo</option>
                <option value="Hipercard">Hipercard</option>
                <option value="American Express">American Express</option>
                <option value="Outros">Outros</option>
              </select>
            </Field>
            <Field label="Final do cartão" error={errors.cardLast4}>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={cardLast4}
                onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, ''))}
                placeholder="0000"
                style={inputStyle}
              />
            </Field>
            {method === 'cartao_credito' && (
              <Field label="Parcelas">
                <select
                  value={cardInstallments}
                  onChange={(e) => setCardInstallments(parseInt(e.target.value, 10))}
                  style={inputStyle}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}x {n === 1 ? '(à vista)' : ''}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
        )}

        {method === 'boleto' && (
          <Field label="Código de barras / linha digitável (opcional)" icon="hash">
            <input
              type="text"
              value={boletoBarcode}
              onChange={(e) => setBoletoBarcode(e.target.value)}
              placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000"
              style={{ ...inputStyle, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}
            />
          </Field>
        )}

        {method === 'plano_saude' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Convênio" required error={errors.convenio} icon="shield">
              <input
                type="text"
                value={convenioName}
                onChange={(e) => setConvenioName(e.target.value)}
                placeholder="Ex.: Unimed, Amil, Bradesco Saúde…"
                style={inputStyle}
              />
            </Field>
            <Field label="Número da guia (opcional)" icon="file">
              <input
                type="text"
                value={convenioGuide}
                onChange={(e) => setConvenioGuide(e.target.value)}
                style={inputStyle}
              />
            </Field>
          </div>
        )}

        <Field label="Observação (opcional)">
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex.: pago no caixa pela mãe da paciente"
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </Field>
      </div>
    </ModalShell>
  );
}
