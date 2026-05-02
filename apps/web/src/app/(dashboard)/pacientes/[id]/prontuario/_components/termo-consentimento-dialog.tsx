'use client';

import * as React from 'react';
import { Glass, Btn, Ico, Mono, T, Badge } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { useToast } from '@dermaos/ui';

/* ── Props ───────────────────────────────────────────────────────────────── */

interface TermoConsentimentoDialogProps {
  patientId:      string;
  patientName?:   string | null;
  procedureId?:   string | null;
  lesionPhotoId?: string | null;
  /** Custom description override; otherwise uses default template */
  description?:   string;
  onClose:        () => void;
  onCreated?:     (termId: string) => void;
}

/* ── Default template text ───────────────────────────────────────────────── */

const DEFAULT_TERM_TEXT = `TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO

Eu, [Nome do Paciente], declaro que fui devidamente informado(a) pelo(a) médico(a) responsável sobre:

1. O procedimento/tratamento a ser realizado, seus objetivos, técnicas utilizadas e resultados esperados.

2. Os riscos e possíveis efeitos colaterais ou adversos, incluindo: eritema, edema transitório, equimoses, alterações pigmentares e reações alérgicas.

3. As alternativas terapêuticas disponíveis.

4. A necessidade de seguir rigorosamente as orientações pós-procedimento fornecidas.

5. A possibilidade de não atingir o resultado esperado ou de necessidade de sessões adicionais.

Declaro que todas as minhas dúvidas foram esclarecidas de forma satisfatória e que estou ciente dos riscos e benefícios do procedimento proposto.

AUTORIZO a realização do procedimento e me comprometo a informar qualquer intercorrência ao médico assistente.`;

/* ── Main dialog ─────────────────────────────────────────────────────────── */

export function TermoConsentimentoDialog({
  patientId,
  patientName,
  procedureId,
  lesionPhotoId,
  description,
  onClose,
  onCreated,
}: TermoConsentimentoDialogProps) {
  const { toast } = useToast();
  const [termText, setTermText] = React.useState(description ?? DEFAULT_TERM_TEXT);
  const [patientSigned, setPatientSigned] = React.useState(false);
  const [createdTermId, setCreatedTermId] = React.useState<string | null>(null);
  const [step, setStep] = React.useState<'edit' | 'sign' | 'done'>('edit');

  const createMut = trpc.clinical.documents.createConsentTerm.useMutation();
  const signMut   = trpc.clinical.documents.signConsentTerm.useMutation();

  const isPending = createMut.isPending || signMut.isPending;

  async function handleCreateTerm() {
    try {
      const res = await createMut.mutateAsync({
        patientId,
        procedureId:  procedureId ?? undefined,
        lesionPhotoId: lesionPhotoId ?? undefined,
        description:  termText,
      });
      setCreatedTermId(res.term.id);
      setStep('sign');
      toast.success('Termo criado — aguardando assinatura do paciente');
    } catch (e) {
      toast.error('Falha ao criar termo', { description: e instanceof Error ? e.message : 'Tente novamente.' });
    }
  }

  async function handleSignTerm() {
    if (!createdTermId) return;
    try {
      await signMut.mutateAsync({ id: createdTermId });
      setStep('done');
      toast.success('Consentimento registrado com sucesso');
      onCreated?.(createdTermId);
    } catch (e) {
      toast.error('Falha ao registrar assinatura', { description: e instanceof Error ? e.message : 'Tente novamente.' });
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 900,
        background: 'rgba(10,16,12,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={step !== 'done' ? onClose : undefined}
    >
      <Glass
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 660,
          maxHeight: '92vh',
          overflow: 'auto',
          padding: 30,
          display: 'flex', flexDirection: 'column', gap: 20,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <Mono size={10} spacing="1.5px" color={T.accent} style={{ display: 'block', marginBottom: 4 }}>
              TERMO DE CONSENTIMENTO
            </Mono>
            <p style={{ fontSize: 17, fontWeight: 600, color: T.textPrimary }}>
              {step === 'edit' ? 'Revisar e preparar termo' :
               step === 'sign' ? 'Assinatura do paciente' :
               'Consentimento registrado'}
            </p>
            {patientName && (
              <p style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>Paciente: {patientName}</p>
            )}
          </div>
          {step !== 'done' && (
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted, padding: 4 }}
            >
              <Ico name="alert" size={18} />
            </button>
          )}
        </div>

        {/* Context tags */}
        {(procedureId || lesionPhotoId) && (
          <div style={{ display: 'flex', gap: 8 }}>
            {procedureId && (
              <Badge variant="default" dot={false}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Ico name="edit" size={11} color={T.textMuted} />
                  Procedimento vinculado
                </span>
              </Badge>
            )}
            {lesionPhotoId && (
              <Badge variant="default" dot={false}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Ico name="file" size={11} color={T.textMuted} />
                  Foto vinculada
                </span>
              </Badge>
            )}
          </div>
        )}

        {/* Step: edit */}
        {step === 'edit' && (
          <>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ fontSize: 12, color: T.textSecondary }}>Texto do termo *</label>
                <Mono size={10} color={T.textMuted}>{termText.length} chars</Mono>
              </div>
              <textarea
                value={termText}
                onChange={(e) => setTermText(e.target.value)}
                rows={16}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: T.r.md,
                  background: T.inputBg,
                  border: `1px solid ${T.inputBorder}`,
                  color: T.textPrimary,
                  fontSize: 12.5,
                  fontFamily: "'IBM Plex Mono', monospace",
                  lineHeight: 1.7,
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{
              background: T.warningBg,
              border: `1px solid ${T.warningBorder}`,
              borderRadius: T.r.md,
              padding: '10px 14px',
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <Ico name="alert" size={16} color={T.warning} style={{ marginTop: 1, flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: T.warning, lineHeight: 1.5 }}>
                Substitua os campos entre colchetes <code style={{ fontFamily: 'inherit' }}>[...]</code> com os dados reais do paciente antes de apresentar o termo para assinatura.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Btn variant="ghost" small onClick={onClose} disabled={isPending}>Cancelar</Btn>
              <Btn
                variant="accent"
                small
                icon="check"
                loading={isPending}
                disabled={!termText.trim() || isPending}
                onClick={() => void handleCreateTerm()}
              >
                Gerar e apresentar ao paciente
              </Btn>
            </div>
          </>
        )}

        {/* Step: sign */}
        {step === 'sign' && (
          <>
            {/* Term preview */}
            <div style={{
              background: 'white',
              border: `1px solid ${T.divider}`,
              borderRadius: T.r.md,
              padding: '20px 24px',
              fontSize: 12.5,
              color: '#1a1a1a',
              lineHeight: 1.7,
              maxHeight: 360,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
            }}>
              {termText}
            </div>

            {/* Signature capture */}
            <div style={{
              background: T.glass,
              border: `1px solid ${T.glassBorder}`,
              borderRadius: T.r.md,
              padding: '18px 22px',
              display: 'flex', flexDirection: 'column', gap: 14,
            }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>
                Confirmação de assinatura presencial
              </p>
              <p style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.5 }}>
                Confirme que o paciente <strong>{patientName ?? 'identificado'}</strong> leu, compreendeu e assinou este termo presencialmente.
              </p>

              {/* Checkbox */}
              <label style={{
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={patientSigned}
                  onChange={(e) => setPatientSigned(e.target.checked)}
                  style={{ width: 18, height: 18, cursor: 'pointer', accentColor: T.accent }}
                />
                <span style={{ fontSize: 13, color: T.textPrimary }}>
                  O paciente assinou fisicamente o termo impresso / na tela.
                </span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Btn variant="ghost" small onClick={onClose} disabled={isPending}>Fechar sem registrar</Btn>
              <Btn
                variant="primary"
                small
                icon="check"
                loading={isPending}
                disabled={!patientSigned || isPending}
                onClick={() => void handleSignTerm()}
              >
                Registrar consentimento
              </Btn>
            </div>
          </>
        )}

        {/* Step: done */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: T.successBg, border: `1px solid ${T.successBorder}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <Ico name="check" size={26} color={T.success} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 600, color: T.textPrimary, marginBottom: 6 }}>
              Consentimento registrado
            </p>
            <p style={{ fontSize: 13, color: T.textSecondary, marginBottom: 20 }}>
              O termo de consentimento foi criado, assinado e vinculado ao prontuário do paciente.
            </p>
            <Btn variant="primary" small onClick={onClose}>Fechar</Btn>
          </div>
        )}
      </Glass>
    </div>
  );
}
