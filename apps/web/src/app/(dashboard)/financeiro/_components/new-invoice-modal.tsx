'use client';

import * as React from 'react';
import { useToast } from '@dermaos/ui';
import { Btn, Ico, T, Field, Mono } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import {
  DISCOUNT_REASONS,
  DISCOUNT_REASON_LABELS,
  type DiscountReason,
} from '@dermaos/shared';
import { ModalShell, ModalActions } from './modal-shell';
import { PatientPicker } from './patient-picker';
import { fmtBRLFull } from '../_lib/format';

interface NewInvoiceModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (invoiceId: string) => void;
  /** Pré-seleciona paciente (ex.: vindo do prontuário) */
  initialPatient?: { id: string; name: string } | null;
}

interface ItemRow {
  uid:        string;
  serviceId:  string | null;
  quantity:   number;
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

let nextUid = 0;

export function NewInvoiceModal({
  open,
  onClose,
  onCreated,
  initialPatient = null,
}: NewInvoiceModalProps) {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [patient, setPatient] = React.useState<{ id: string; name: string } | null>(
    initialPatient,
  );
  const [providerId, setProviderId] = React.useState<string>('');
  const [dueDate, setDueDate]       = React.useState<string>('');
  const [notes, setNotes]           = React.useState<string>('');
  const [items, setItems]           = React.useState<ItemRow[]>([
    { uid: `i${++nextUid}`, serviceId: null, quantity: 1 },
  ]);

  const [discountEnabled, setDiscountEnabled] = React.useState(false);
  const [discountType, setDiscountType] =
    React.useState<'absolute' | 'percentage'>('percentage');
  const [discountValue, setDiscountValue]   = React.useState<number>(0);
  const [discountReason, setDiscountReason] =
    React.useState<DiscountReason>('cortesia');
  const [discountNote, setDiscountNote]     = React.useState<string>('');

  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const servicesQ = trpc.financial.catalog.list.useQuery(
    { isActive: true, page: 1, limit: 100 },
    { enabled: open, staleTime: 60_000 },
  );
  const providersQ = trpc.scheduling.listProviders.useQuery(undefined, {
    enabled: open,
    staleTime: 5 * 60_000,
  });

  const services  = servicesQ.data?.data ?? [];
  const providers = providersQ.data?.providers ?? [];
  const serviceMap = React.useMemo(
    () => new Map(services.map((s) => [s.id, s])),
    [services],
  );

  React.useEffect(() => {
    if (open) {
      setPatient(initialPatient);
      setProviderId('');
      setDueDate('');
      setNotes('');
      setItems([{ uid: `i${++nextUid}`, serviceId: null, quantity: 1 }]);
      setDiscountEnabled(false);
      setDiscountType('percentage');
      setDiscountValue(0);
      setDiscountReason('cortesia');
      setDiscountNote('');
      setErrors({});
    }
  }, [open, initialPatient]);

  const subtotal = React.useMemo(
    () => items.reduce((acc, it) => {
      const svc = it.serviceId ? serviceMap.get(it.serviceId) : null;
      if (!svc) return acc;
      return acc + svc.price * Math.max(1, it.quantity);
    }, 0),
    [items, serviceMap],
  );

  const discountAmount = React.useMemo(() => {
    if (!discountEnabled || discountValue <= 0) return 0;
    if (discountType === 'absolute') {
      return Math.min(discountValue * 100, subtotal); // input em reais → centavos
    }
    return Math.round((subtotal * Math.min(100, discountValue)) / 100);
  }, [discountEnabled, discountType, discountValue, subtotal]);

  const total = Math.max(0, subtotal - discountAmount);

  function updateItem(uid: string, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((it) => (it.uid === uid ? { ...it, ...patch } : it)));
  }
  function removeItem(uid: string) {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((it) => it.uid !== uid)));
  }
  function addItem() {
    setItems((prev) => [...prev, { uid: `i${++nextUid}`, serviceId: null, quantity: 1 }]);
  }

  const createMutation = trpc.financial.invoices.create.useMutation({
    onSuccess: (inv) => {
      void utils.financial.invoices.list.invalidate();
      void utils.financial.caixa.getDia.invalidate();
      toast.success('Fatura criada', {
        description: 'Rascunho gerado. Emita ou ajuste antes de cobrar.',
      });
      onCreated?.(inv.id);
      onClose();
    },
    onError: (err) => {
      toast.error('Erro ao criar fatura', { description: err.message });
    },
  });

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!patient) next.patient = 'Selecione um paciente.';
    const validItems = items.filter((it) => it.serviceId);
    if (validItems.length === 0) next.items = 'Adicione ao menos um serviço.';
    if (validItems.some((it) => it.quantity < 1)) {
      next.items = 'Quantidade deve ser ≥ 1.';
    }
    if (discountEnabled) {
      if (discountValue <= 0) next.discount = 'Valor de desconto inválido.';
      if (discountType === 'percentage' && discountValue > 100) {
        next.discount = 'Desconto não pode exceder 100%.';
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate() || !patient) return;
    const validItems = items.filter((it) => it.serviceId);
    await createMutation.mutateAsync({
      patientId:  patient.id,
      providerId: providerId || undefined,
      dueDate:    dueDate ? new Date(dueDate) : undefined,
      notes:      notes || undefined,
      items: validItems.map((it) => ({
        serviceId: it.serviceId!,
        quantity:  it.quantity,
      })),
      discount: discountEnabled
        ? discountType === 'absolute'
          ? {
              discountType: 'absolute',
              discountValue: discountValue * 100,
              discountReason,
              discountNote: discountNote || undefined,
            }
          : {
              discountType: 'percentage',
              discountValue,
              discountReason,
              discountNote: discountNote || undefined,
            }
        : undefined,
    });
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Nova fatura"
      subtitle="Itens do catálogo, paciente e (opcional) desconto."
      icon="creditCard"
      iconTone="financial"
      width={620}
      footer={
        <ModalActions onCancel={onClose} busy={createMutation.isPending}>
          <Btn
            small
            icon="check"
            loading={createMutation.isPending}
            onClick={handleSubmit}
          >
            Criar rascunho
          </Btn>
        </ModalActions>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Paciente" required error={errors.patient} icon="user">
          <PatientPicker value={patient} onChange={setPatient} error={errors.patient} />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Profissional responsável" icon="user">
            <select
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              style={{
                ...inputStyle,
                appearance: 'none',
                backgroundImage:
                  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' " +
                  "width='14' height='14' viewBox='0 0 24 24' fill='none' " +
                  "stroke='%238E8E8E' stroke-width='1.7' stroke-linecap='round' " +
                  "stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 10px center',
                paddingRight: 32,
              }}
            >
              <option value="">— Selecione —</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Vencimento" icon="calendar">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={inputStyle}
            />
          </Field>
        </div>

        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: T.textSecondary,
                fontFamily: "'IBM Plex Sans', sans-serif",
              }}
            >
              ITENS · SERVIÇOS DO CATÁLOGO
            </span>
            <button
              type="button"
              onClick={addItem}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 12,
                color: T.financial.color,
                cursor: 'pointer',
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Ico name="plus" size={12} color={T.financial.color} /> Adicionar item
            </button>
          </div>

          <div
            style={{
              borderRadius: T.r.md,
              border: `1px solid ${errors.items ? T.danger : T.divider}`,
              overflow: 'hidden',
              background: 'white',
            }}
          >
            {items.map((it, idx) => {
              const svc = it.serviceId ? serviceMap.get(it.serviceId) : null;
              const lineTotal = svc ? svc.price * Math.max(1, it.quantity) : 0;
              return (
                <div
                  key={it.uid}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 70px 110px 24px',
                    gap: 8,
                    padding: '10px 12px',
                    alignItems: 'center',
                    borderBottom:
                      idx < items.length - 1 ? `1px solid ${T.divider}` : 'none',
                  }}
                >
                  <select
                    value={it.serviceId ?? ''}
                    onChange={(e) =>
                      updateItem(it.uid, { serviceId: e.target.value || null })
                    }
                    style={{
                      ...inputStyle,
                      padding: '7px 10px',
                      fontSize: 13,
                    }}
                  >
                    <option value="">— Selecione um serviço —</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} · {fmtBRLFull(s.price)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={it.quantity}
                    onChange={(e) =>
                      updateItem(it.uid, {
                        quantity: Math.max(1, parseInt(e.target.value || '1', 10)),
                      })
                    }
                    style={{
                      ...inputStyle,
                      padding: '7px 10px',
                      fontSize: 13,
                      textAlign: 'center',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: T.textPrimary,
                      textAlign: 'right',
                    }}
                  >
                    {fmtBRLFull(lineTotal)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(it.uid)}
                    aria-label="Remover item"
                    disabled={items.length === 1}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: items.length === 1 ? 'not-allowed' : 'pointer',
                      padding: 2,
                      opacity: items.length === 1 ? 0.3 : 1,
                      display: 'flex',
                    }}
                  >
                    <Ico name="x" size={14} color={T.textMuted} />
                  </button>
                </div>
              );
            })}
          </div>
          {errors.items && (
            <p style={{ marginTop: 4, fontSize: 11, color: T.danger }}>{errors.items}</p>
          )}
        </div>

        <div>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              color: T.textSecondary,
              cursor: 'pointer',
              fontFamily: "'IBM Plex Sans', sans-serif",
            }}
          >
            <input
              type="checkbox"
              checked={discountEnabled}
              onChange={(e) => setDiscountEnabled(e.target.checked)}
              style={{ accentColor: T.financial.color }}
            />
            Aplicar desconto
          </label>

          {discountEnabled && (
            <div
              style={{
                marginTop: 10,
                padding: 12,
                borderRadius: T.r.md,
                background: T.warningBg,
                border: `1px solid ${T.warningBorder}`,
                display: 'grid',
                gridTemplateColumns: '110px 1fr 1fr',
                gap: 10,
              }}
            >
              <Field label="Tipo">
                <select
                  value={discountType}
                  onChange={(e) =>
                    setDiscountType(e.target.value as 'absolute' | 'percentage')
                  }
                  style={{ ...inputStyle, padding: '7px 10px', fontSize: 13 }}
                >
                  <option value="percentage">%</option>
                  <option value="absolute">R$</option>
                </select>
              </Field>
              <Field label={discountType === 'percentage' ? 'Valor (%)' : 'Valor (R$)'}>
                <input
                  type="number"
                  min={0}
                  step={discountType === 'percentage' ? 1 : 0.01}
                  value={discountValue}
                  onChange={(e) =>
                    setDiscountValue(parseFloat(e.target.value || '0') || 0)
                  }
                  style={{ ...inputStyle, padding: '7px 10px', fontSize: 13 }}
                />
              </Field>
              <Field label="Motivo">
                <select
                  value={discountReason}
                  onChange={(e) =>
                    setDiscountReason(e.target.value as DiscountReason)
                  }
                  style={{ ...inputStyle, padding: '7px 10px', fontSize: 13 }}
                >
                  {DISCOUNT_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {DISCOUNT_REASON_LABELS[r]}
                    </option>
                  ))}
                </select>
              </Field>
              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="Observação (opcional)">
                  <input
                    type="text"
                    value={discountNote}
                    onChange={(e) => setDiscountNote(e.target.value)}
                    placeholder="Ex.: cortesia para parente de paciente fidelizado"
                    style={{ ...inputStyle, padding: '7px 10px', fontSize: 13 }}
                  />
                </Field>
              </div>
              {errors.discount && (
                <p
                  style={{
                    gridColumn: '1 / -1',
                    fontSize: 11,
                    color: T.danger,
                    margin: 0,
                  }}
                >
                  {errors.discount}
                </p>
              )}
            </div>
          )}
        </div>

        <Field label="Observação (visível ao paciente)">
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex.: pagamento até DD/MM via PIX"
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </Field>

        <div
          style={{
            borderTop: `1px solid ${T.divider}`,
            paddingTop: 14,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 4,
          }}
        >
          <Mono size={10} color={T.textMuted}>SUBTOTAL</Mono>
          <span
            style={{ fontSize: 13, color: T.textSecondary, textAlign: 'right' }}
          >
            {fmtBRLFull(subtotal)}
          </span>
          {discountEnabled && discountAmount > 0 && (
            <>
              <Mono size={10} color={T.warning}>DESCONTO</Mono>
              <span
                style={{
                  fontSize: 13,
                  color: T.warning,
                  textAlign: 'right',
                  fontWeight: 600,
                }}
              >
                – {fmtBRLFull(discountAmount)}
              </span>
            </>
          )}
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: T.textPrimary,
              marginTop: 6,
            }}
          >
            Total
          </span>
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: T.financial.color,
              textAlign: 'right',
              marginTop: 6,
              letterSpacing: '-0.02em',
            }}
          >
            {fmtBRLFull(total)}
          </span>
        </div>
      </div>
    </ModalShell>
  );
}
