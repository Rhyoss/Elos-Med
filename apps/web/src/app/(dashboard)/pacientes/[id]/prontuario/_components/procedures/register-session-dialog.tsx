'use client';

import * as React from 'react';
import { Badge, Btn, Glass, Ico, Mono, T } from '@dermaos/ui/ds';
import { LabeledInput } from './labeled-input';
import { ADVERSE_SEVERITY_LABELS, type AdverseSeverity } from '@dermaos/shared';
import { useRegisterSession } from '@/lib/hooks/use-procedures';
import { ProductLotPicker, type SelectedProduct } from './product-lot-picker';

interface RegisterSessionDialogProps {
  patientId: string;
  protocolId: string;
  protocolName: string;
  sessionNumber: number;
  totalSessions: number;
  open: boolean;
  onClose: () => void;
  onRegistered?: () => void;
}

interface AdverseEventForm {
  description: string;
  severity: Exclude<AdverseSeverity, 'none'>;
  action?: string;
}

export function RegisterSessionDialog({
  patientId,
  protocolId,
  protocolName,
  sessionNumber,
  totalSessions,
  open,
  onClose,
  onRegistered,
}: RegisterSessionDialogProps) {
  const registerMut = useRegisterSession(patientId, protocolId);

  const [durationMin, setDurationMin] = React.useState<number | undefined>(undefined);
  const [patientResponse, setPatientResponse] = React.useState('');
  const [products, setProducts] = React.useState<SelectedProduct[]>([]);
  const [adverseEvents, setAdverseEvents] = React.useState<AdverseEventForm[]>([]);
  const [outcome, setOutcome] = React.useState('');
  const [nextSessionNotes, setNextSessionNotes] = React.useState('');
  const [observations, setObservations] = React.useState('');
  const [showProducts, setShowProducts] = React.useState(false);
  const [showAdverse, setShowAdverse] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setDurationMin(undefined);
      setPatientResponse('');
      setProducts([]);
      setAdverseEvents([]);
      setOutcome('');
      setNextSessionNotes('');
      setObservations('');
      setShowProducts(false);
      setShowAdverse(false);
    }
  }, [open]);

  if (!open) return null;

  const hasExpiredLot = products.some(
    (p) => p.expiryDate && new Date(p.expiryDate) < new Date(),
  );

  async function handleSubmit() {
    if (hasExpiredLot) return;
    try {
      await registerMut.mutateAsync({
        protocolId,
        durationMin,
        patientResponse: patientResponse.trim() || undefined,
        productsConsumed: products.map((p) => ({
          productId: p.productId,
          quantity: p.quantity,
          lotId: p.lotId,
          notes: p.notes,
        })),
        adverseEvents: adverseEvents.map((e) => ({
          description: e.description,
          severity: e.severity,
          action: e.action,
        })),
        outcome: outcome.trim() || undefined,
        nextSessionNotes: nextSessionNotes.trim() || undefined,
        observations: observations.trim() || undefined,
        preImageIds: [],
        postImageIds: [],
      });
      onRegistered?.();
      onClose();
    } catch {
      // error handled by mutation hook
    }
  }

  function addAdverseEvent() {
    setAdverseEvents([...adverseEvents, { description: '', severity: 'leve' }]);
  }

  function updateAdverseEvent(idx: number, patch: Partial<AdverseEventForm>) {
    setAdverseEvents(adverseEvents.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }

  function removeAdverseEvent(idx: number) {
    setAdverseEvents(adverseEvents.filter((_, i) => i !== idx));
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(6px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: '100%', maxWidth: 620, maxHeight: '90vh',
          background: '#fff', borderRadius: T.r.xl,
          boxShadow: T.shadow.xl, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: `1px solid ${T.divider}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <p style={{ fontSize: 17, fontWeight: 700, color: T.textPrimary }}>
                Registrar Sessão
              </p>
              <Badge variant="default" dot={false}>
                {sessionNumber}/{totalSessions}
              </Badge>
            </div>
            <Mono size={10} color={T.textMuted}>{protocolName}</Mono>
          </div>
          <button
            type="button" onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <Ico name="x" size={20} color={T.textMuted} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Duration */}
          <LabeledInput
            label="Duração da sessão (min)"
            type="number"
            value={durationMin != null ? String(durationMin) : ''}
            onChange={(e) => setDurationMin(e.target.value ? Number(e.target.value) : undefined)}
            placeholder="Ex: 30"
            min={1}
            max={600}
          />

          {/* Patient response */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, marginBottom: 6, display: 'block' }}>
              Resposta do paciente
            </label>
            <textarea
              value={patientResponse}
              onChange={(e) => setPatientResponse(e.target.value)}
              placeholder="Como o paciente respondeu ao tratamento…"
              rows={2}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: T.r.md,
                border: `1px solid ${T.inputBorder}`, background: T.inputBg,
                fontSize: 14, fontFamily: "'IBM Plex Sans', sans-serif",
                resize: 'vertical', color: T.textPrimary,
              }}
            />
          </div>

          {/* Products consumed */}
          <Glass style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, color: T.textPrimary }}>
                  Produtos consumidos
                </p>
                <p style={{ fontSize: 12, color: T.textMuted }}>
                  Registre os produtos e lotes utilizados nesta sessão.
                </p>
              </div>
              <Btn variant="ghost" small icon="chevDown" onClick={() => setShowProducts(!showProducts)}>
                {products.length > 0 ? `${products.length} produto(s)` : 'Adicionar'}
              </Btn>
            </div>
            {showProducts && (
              <div style={{ marginTop: 12 }}>
                <ProductLotPicker value={products} onChange={setProducts} />
              </div>
            )}
          </Glass>

          {/* Adverse events */}
          <Glass style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, color: T.textPrimary }}>
                  Eventos adversos
                </p>
                <p style={{ fontSize: 12, color: T.textMuted }}>
                  Registre qualquer reação adversa ocorrida.
                </p>
              </div>
              <Btn variant="ghost" small icon="chevDown" onClick={() => setShowAdverse(!showAdverse)}>
                {adverseEvents.length > 0 ? `${adverseEvents.length} evento(s)` : 'Registrar'}
              </Btn>
            </div>
            {showAdverse && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {adverseEvents.map((evt, idx) => (
                  <div key={idx} style={{
                    padding: 12, borderRadius: T.r.md,
                    border: `1px solid ${T.warningBorder}`, background: T.warningBg,
                  }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <div style={{ flex: 1 }}>
                        <LabeledInput
                          label="Descrição *"
                          value={evt.description}
                          onChange={(e) => updateAdverseEvent(idx, { description: e.target.value })}
                          placeholder="Descreva o evento adverso…"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAdverseEvent(idx)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, alignSelf: 'flex-end' }}
                      >
                        <Ico name="x" size={14} color={T.danger} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <div>
                        <Mono size={9} color={T.textMuted} style={{ marginBottom: 4 }}>GRAVIDADE</Mono>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {(['leve', 'moderado', 'grave'] as const).map((sev) => (
                            <button
                              key={sev}
                              type="button"
                              onClick={() => updateAdverseEvent(idx, { severity: sev })}
                              style={{
                                padding: '4px 10px', borderRadius: T.r.sm,
                                border: `1px solid ${evt.severity === sev ? (sev === 'grave' ? T.danger : T.warning) : T.glassBorder}`,
                                background: evt.severity === sev ? (sev === 'grave' ? T.dangerBg : T.warningBg) : 'transparent',
                                color: evt.severity === sev ? (sev === 'grave' ? T.danger : T.warning) : T.textMuted,
                                fontSize: 12, cursor: 'pointer',
                              }}
                            >
                              {ADVERSE_SEVERITY_LABELS[sev]}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <LabeledInput
                      label="Conduta"
                      value={evt.action ?? ''}
                      onChange={(e) => updateAdverseEvent(idx, { action: e.target.value })}
                      placeholder="Conduta adotada…"
                    />
                  </div>
                ))}
                <Btn variant="glass" small icon="plus" onClick={addAdverseEvent}>
                  Adicionar evento adverso
                </Btn>
              </div>
            )}
          </Glass>

          {/* Outcome */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, marginBottom: 6, display: 'block' }}>
              Resultado da sessão
            </label>
            <textarea
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="Resultado observado nesta sessão…"
              rows={2}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: T.r.md,
                border: `1px solid ${T.inputBorder}`, background: T.inputBg,
                fontSize: 14, fontFamily: "'IBM Plex Sans', sans-serif",
                resize: 'vertical', color: T.textPrimary,
              }}
            />
          </div>

          {/* Next session notes */}
          <LabeledInput
            label="Notas para próxima sessão"
            value={nextSessionNotes}
            onChange={(e) => setNextSessionNotes(e.target.value)}
            placeholder="Ajustes para a próxima sessão…"
          />

          {/* Observations */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, marginBottom: 6, display: 'block' }}>
              Observações
            </label>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Anotações adicionais…"
              rows={2}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: T.r.md,
                border: `1px solid ${T.inputBorder}`, background: T.inputBg,
                fontSize: 14, fontFamily: "'IBM Plex Sans', sans-serif",
                resize: 'vertical', color: T.textPrimary,
              }}
            />
          </div>

          {/* TODO: integrar upload de fotos antes/depois quando endpoint disponível */}
          <div style={{
            padding: '10px 14px', borderRadius: T.r.md,
            background: T.infoBg, border: `1px solid ${T.infoBorder}`,
            display: 'flex', gap: 8, alignItems: 'center',
          }}>
            <Ico name="image" size={14} color={T.info} />
            <p style={{ fontSize: 12, color: T.info }}>
              Fotos antes/depois: use a aba Imagens do prontuário para anexar fotos clínicas.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: `1px solid ${T.divider}`,
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <Btn variant="ghost" small onClick={onClose}>Cancelar</Btn>
          <Btn
            small icon="check"
            onClick={handleSubmit}
            disabled={registerMut.isPending || hasExpiredLot}
          >
            {registerMut.isPending ? 'Registrando…' : 'Registrar Sessão'}
          </Btn>
        </div>

        {hasExpiredLot && (
          <div style={{ padding: '8px 20px 12px', background: T.dangerBg }}>
            <p style={{ fontSize: 12, color: T.danger }}>
              Lote vencido selecionado. Corrija antes de registrar.
            </p>
          </div>
        )}

        {registerMut.isError && (
          <div style={{ padding: '8px 20px 12px', background: T.dangerBg }}>
            <p style={{ fontSize: 12, color: T.danger }}>
              Erro: {registerMut.error?.message ?? 'Erro desconhecido'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
