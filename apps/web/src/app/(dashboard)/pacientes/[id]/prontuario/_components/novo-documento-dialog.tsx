'use client';

import * as React from 'react';
import { Glass, Btn, Ico, Input, Mono, T, Badge } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { useToast } from '@dermaos/ui';
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  type DocumentType,
} from '@dermaos/shared';

/* ── Props ───────────────────────────────────────────────────────────────── */

interface NovoDocumentoDialogProps {
  patientId:    string;
  patientName?: string | null;
  encounterId?: string | null;
  onClose:      () => void;
  onCreated?:   (id: string) => void;
}

/* ── Constants ───────────────────────────────────────────────────────────── */

const DOCUMENT_ICONS: Record<DocumentType, string> = {
  prescricao:                  '💊',
  termo_consentimento:         '✍️',
  atestado:                    '📋',
  declaracao:                  '📄',
  solicitacao:                 '📝',
  orientacao_pos_procedimento: '🩹',
  laudo:                       '🔬',
  anexo:                       '📎',
};

const CONTENT_TEMPLATES: Partial<Record<DocumentType, string>> = {
  atestado: `<p>Atesto, para os devidos fins, que <strong>[Nome do Paciente]</strong>, portador(a) do documento nº [CPF/RG], esteve sob minha assistência médica em [Data], necessitando de repouso por [X] dias, a contar de [Data de início].</p>
<p>CRM: [Número do CRM]</p>`,

  declaracao: `<p>Declaro, para os devidos fins, que <strong>[Nome do Paciente]</strong> realizou consulta/procedimento dermatológico nesta clínica na data de [Data].</p>`,

  orientacao_pos_procedimento: `<p><strong>Orientações pós-procedimento</strong></p>
<ul>
<li>Evite exposição solar nas próximas 48h</li>
<li>Não manipule a área tratada</li>
<li>Em caso de reações adversas, entre em contato imediatamente</li>
<li>Use protetor solar FPS 50+ diariamente</li>
</ul>`,

  solicitacao: `<p>Solicito ao(à) colega a avaliação de <strong>[Nome do Paciente]</strong> para [motivo da solicitação].</p>`,
};

/* ── Main dialog ─────────────────────────────────────────────────────────── */

export function NovoDocumentoDialog({
  patientId,
  patientName,
  encounterId,
  onClose,
  onCreated,
}: NovoDocumentoDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = React.useState<'type' | 'content'>('type');
  const [type, setType] = React.useState<DocumentType | null>(null);
  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');

  const createMut = trpc.clinical.documents.create.useMutation();
  const signMut   = trpc.clinical.documents.sign.useMutation();

  function selectType(t: DocumentType) {
    setType(t);
    setTitle(DOCUMENT_TYPE_LABELS[t]);
    setContent(CONTENT_TEMPLATES[t] ?? '');
    setStep('content');
  }

  async function handleSaveDraft() {
    if (!type || !title.trim()) return;
    try {
      const res = await createMut.mutateAsync({
        patientId,
        encounterId:  encounterId ?? undefined,
        type,
        title:        title.trim(),
        contentHtml:  content || undefined,
      });
      toast.success('Documento criado como rascunho');
      onCreated?.(res.document.id);
      onClose();
    } catch (e) {
      toast.error('Falha ao criar documento', { description: e instanceof Error ? e.message : 'Tente novamente.' });
    }
  }

  async function handleEmit() {
    if (!type || !title.trim()) return;
    try {
      const res = await createMut.mutateAsync({
        patientId,
        encounterId:  encounterId ?? undefined,
        type,
        title:        title.trim(),
        contentHtml:  content || undefined,
      });
      await signMut.mutateAsync({ id: res.document.id });
      toast.success('Documento emitido e assinado');
      onCreated?.(res.document.id);
      onClose();
    } catch (e) {
      toast.error('Falha ao emitir documento', { description: e instanceof Error ? e.message : 'Tente novamente.' });
    }
  }

  const isPending = createMut.isPending || signMut.isPending;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 900,
        background: 'rgba(10,16,12,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <Glass
        onClick={(e) => e.stopPropagation()}
        style={{
          width: step === 'type' ? 560 : 720,
          maxHeight: '90vh',
          overflow: 'auto',
          padding: 28,
          display: 'flex', flexDirection: 'column', gap: 20,
          transition: 'width 0.25s ease',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              {step === 'content' && (
                <button
                  onClick={() => setStep('type')}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '2px 6px', borderRadius: T.r.sm,
                    color: T.textMuted, fontSize: 13,
                  }}
                >
                  ← Voltar
                </button>
              )}
              <Mono size={10} spacing="1.5px" color={T.primary}>NOVO DOCUMENTO</Mono>
            </div>
            <p style={{ fontSize: 17, fontWeight: 600, color: T.textPrimary }}>
              {step === 'type' ? 'Qual tipo de documento?' : DOCUMENT_TYPE_LABELS[type!]}
            </p>
            {patientName && (
              <p style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>Paciente: {patientName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: T.textMuted, padding: 4,
            }}
          >
            <Ico name="alert" size={18} />
          </button>
        </div>

        {/* Step 1: type picker */}
        {step === 'type' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {DOCUMENT_TYPES.filter((t) => t !== 'prescricao').map((t) => (
              <button
                key={t}
                onClick={() => selectType(t)}
                style={{
                  background: T.glass,
                  border: `1px solid ${T.glassBorder}`,
                  borderRadius: T.r.md,
                  padding: '14px 16px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.18s',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = T.primaryBorder;
                  (e.currentTarget as HTMLButtonElement).style.background = T.glassHover;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = T.glassBorder;
                  (e.currentTarget as HTMLButtonElement).style.background = T.glass;
                }}
              >
                <span style={{ fontSize: 22 }}>{DOCUMENT_ICONS[t]}</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>
                    {DOCUMENT_TYPE_LABELS[t]}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: content editor */}
        {step === 'content' && type && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Title */}
            <div>
              <label style={{ fontSize: 12, color: T.textSecondary, display: 'block', marginBottom: 6 }}>
                Título *
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={DOCUMENT_TYPE_LABELS[type]}
                maxLength={300}
              />
            </div>

            {/* Content */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 12, color: T.textSecondary }}>Conteúdo</label>
                <Mono size={10} color={T.textMuted}>{content.length}/100.000</Mono>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
                placeholder="Conteúdo do documento… (suporta HTML básico)"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: T.r.md,
                  background: T.inputBg,
                  border: `1px solid ${T.inputBorder}`,
                  color: T.textPrimary,
                  fontSize: 13,
                  fontFamily: "'IBM Plex Mono', monospace",
                  lineHeight: 1.6,
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
              <p style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>
                Use {"<strong>"}, {"<em>"}, {"<p>"}, {"<ul>"}, {"<li>"} para formatação básica.
              </p>
            </div>

            {/* Preview box */}
            {content && (
              <div>
                <Mono size={10} spacing="1.2px" color={T.textMuted} style={{ display: 'block', marginBottom: 6 }}>
                  PRÉ-VISUALIZAÇÃO
                </Mono>
                <div
                  style={{
                    background: T.bg,
                    border: `1px solid ${T.divider}`,
                    borderRadius: T.r.md,
                    padding: '14px 18px',
                    fontSize: 13,
                    color: T.textPrimary,
                    lineHeight: 1.65,
                    maxHeight: 200,
                    overflow: 'auto',
                  }}
                  /* eslint-disable-next-line react/no-danger */
                  dangerouslySetInnerHTML={{ __html: content }}
                />
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <Btn variant="ghost" small onClick={onClose} disabled={isPending}>Cancelar</Btn>
              <Btn
                variant="ghost"
                small
                loading={createMut.isPending && !signMut.isPending}
                disabled={!title.trim() || isPending}
                onClick={() => void handleSaveDraft()}
              >
                Salvar rascunho
              </Btn>
              <Btn
                variant="primary"
                small
                icon="check"
                loading={isPending}
                disabled={!title.trim() || isPending}
                onClick={() => void handleEmit()}
              >
                Emitir e assinar
              </Btn>
            </div>
          </div>
        )}
      </Glass>
    </div>
  );
}
