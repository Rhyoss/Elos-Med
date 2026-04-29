'use client';

import * as React from 'react';
import { Btn, Glass, Ico, MetalTag, Mono, T, type IcoName } from '@dermaos/ui/ds';

export type ShareScope = 'internal' | 'patient' | 'external';
export type SharePackage =
  | 'summary'
  | 'prescription'
  | 'exam_request'
  | 'attestation'
  | 'report'
  | 'orientation';
export type ShareChannel = 'portal' | 'email' | 'whatsapp' | 'pdf' | 'link';

export interface SharePayload {
  scope:    ShareScope;
  packages: SharePackage[];
  channels: ShareChannel[];
  expiresInHours?: number;
  recipientNote?:  string;
  /** Internal share — recipient ids/teams (UI stub for now). */
  internalRecipients?: string[];
}

export interface RecordShareDialogProps {
  open:       boolean;
  onClose:    () => void;
  onConfirm:  (payload: SharePayload) => void;
  isSubmitting?: boolean;
}

const SCOPE_OPTIONS: Array<{ id: ShareScope; label: string; icon: IcoName; description: string }> = [
  {
    id:    'internal',
    label: 'Equipe interna',
    icon:  'users',
    description: 'Compartilhar com médico ou equipe da clínica. Registra log de acesso.',
  },
  {
    id:    'patient',
    label: 'Paciente',
    icon:  'user',
    description: 'Enviar resumo, prescrição ou orientações via portal, e-mail ou WhatsApp.',
  },
  {
    id:    'external',
    label: 'Externo',
    icon:  'globe',
    description: 'Encaminhamento para outro profissional ou instituição. Exige consentimento.',
  },
];

const PACKAGE_OPTIONS: Array<{ id: SharePackage; label: string; icon: IcoName }> = [
  { id: 'summary',      label: 'Resumo pós-consulta', icon: 'file'       },
  { id: 'prescription', label: 'Prescrição',          icon: 'file'       },
  { id: 'exam_request', label: 'Pedido de exame',     icon: 'activity'   },
  { id: 'attestation',  label: 'Atestado',            icon: 'shield'     },
  { id: 'report',       label: 'Relatório',           icon: 'barChart'   },
  { id: 'orientation',  label: 'Orientações',         icon: 'message'    },
];

const CHANNEL_OPTIONS: Array<{ id: ShareChannel; label: string; icon: IcoName }> = [
  { id: 'portal',   label: 'Portal do paciente', icon: 'lock'    },
  { id: 'email',    label: 'E-mail',             icon: 'mail'    },
  { id: 'whatsapp', label: 'WhatsApp',           icon: 'message' },
  { id: 'pdf',      label: 'PDF assinado',       icon: 'download' },
  { id: 'link',     label: 'Link com expiração', icon: 'link'    },
];

export function RecordShareDialog({
  open,
  onClose,
  onConfirm,
  isSubmitting,
}: RecordShareDialogProps) {
  const [scope, setScope] = React.useState<ShareScope>('patient');
  const [packages, setPackages] = React.useState<Set<SharePackage>>(new Set(['summary']));
  const [channels, setChannels] = React.useState<Set<ShareChannel>>(new Set(['portal']));
  const [expires, setExpires] = React.useState<number>(72);
  const [note, setNote] = React.useState('');

  if (!open) return null;

  function togglePackage(p: SharePackage) {
    setPackages((s) => {
      const next = new Set(s);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }
  function toggleChannel(c: ShareChannel) {
    setChannels((s) => {
      const next = new Set(s);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  const canSubmit = packages.size > 0 && channels.size > 0;

  return (
    <div
      role="dialog"
      aria-modal
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.42)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Glass
        style={{
          maxWidth: 640,
          width: '100%',
          padding: '22px 26px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Ico name="link" size={18} color={T.primary} />
          <Mono size={9} spacing="1.2px" color={T.primary}>COMPARTILHAR PRONTUÁRIO</Mono>
        </div>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: T.textPrimary,
            margin: '0 0 14px',
            letterSpacing: '-0.01em',
          }}
        >
          Quem deve receber este prontuário?
        </h2>

        {/* Scope */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {SCOPE_OPTIONS.map((opt) => {
            const active = scope === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setScope(opt.id)}
                style={{
                  textAlign: 'left',
                  padding: '12px 14px',
                  borderRadius: T.r.lg,
                  background: active ? T.primaryBg : T.glass,
                  border: `1px solid ${active ? T.primary : T.glassBorder}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <Ico name={opt.icon} size={18} color={active ? T.primary : T.textMuted} />
                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: T.textPrimary,
                    margin: '6px 0 4px',
                  }}
                >
                  {opt.label}
                </p>
                <p style={{ fontSize: 10, color: T.textMuted, margin: 0, lineHeight: 1.4 }}>
                  {opt.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Packages */}
        <div style={{ marginTop: 18 }}>
          <Mono size={9} spacing="1px" color={T.primary}>CONTEÚDO</Mono>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 6,
              marginTop: 8,
            }}
          >
            {PACKAGE_OPTIONS.map((opt) => {
              const active = packages.has(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => togglePackage(opt.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: T.r.md,
                    background: active ? T.primaryBg : T.glass,
                    border: `1px solid ${active ? T.primaryBorder : T.glassBorder}`,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.12s',
                  }}
                >
                  <Ico name={opt.icon} size={14} color={active ? T.primary : T.textMuted} />
                  <span style={{ fontSize: 12, color: T.textPrimary, fontFamily: "'IBM Plex Sans', sans-serif" }}>
                    {opt.label}
                  </span>
                  {active && <Ico name="check" size={13} color={T.primary} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Channels */}
        <div style={{ marginTop: 18 }}>
          <Mono size={9} spacing="1px" color={T.primary}>CANAL DE ENVIO</Mono>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 6,
              marginTop: 8,
            }}
          >
            {CHANNEL_OPTIONS.map((opt) => {
              const active = channels.has(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleChannel(opt.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 10px',
                    borderRadius: T.r.md,
                    background: active ? T.primaryBg : T.glass,
                    border: `1px solid ${active ? T.primaryBorder : T.glassBorder}`,
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                  }}
                >
                  <Ico name={opt.icon} size={13} color={active ? T.primary : T.textMuted} />
                  <span style={{ fontSize: 11, color: T.textPrimary, fontFamily: "'IBM Plex Sans', sans-serif" }}>
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Expiration */}
        {channels.has('link') && (
          <div style={{ marginTop: 14 }}>
            <Mono size={9} spacing="1px">EXPIRAÇÃO DO LINK</Mono>
            <select
              value={expires}
              onChange={(e) => setExpires(Number(e.target.value))}
              style={{
                marginTop: 6,
                width: '100%',
                padding: '6px 10px',
                borderRadius: T.r.md,
                background: T.inputBg,
                border: `1px solid ${T.inputBorder}`,
                fontSize: 12,
                color: T.textPrimary,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value={24}>24 horas</option>
              <option value={72}>3 dias</option>
              <option value={168}>7 dias</option>
              <option value={720}>30 dias</option>
            </select>
          </div>
        )}

        {/* Recipient note */}
        <div style={{ marginTop: 14 }}>
          <Mono size={9} spacing="1px">MENSAGEM AO DESTINATÁRIO (OPCIONAL)</Mono>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              scope === 'patient'
                ? 'Ex: Segue resumo da sua consulta. Qualquer dúvida nos contate.'
                : scope === 'external'
                  ? 'Ex: Encaminho paciente para avaliação dermatológica.'
                  : 'Ex: Compartilhando para discussão de caso.'
            }
            style={{
              marginTop: 6,
              width: '100%',
              minHeight: 60,
              padding: '8px 10px',
              borderRadius: T.r.md,
              background: T.inputBg,
              border: `1px solid ${T.inputBorder}`,
              fontSize: 12,
              fontFamily: "'IBM Plex Sans', sans-serif",
              color: T.textPrimary,
              outline: 'none',
              resize: 'vertical',
            }}
          />
        </div>

        {/* Compliance footer */}
        <div
          style={{
            marginTop: 14,
            padding: '10px 12px',
            borderRadius: T.r.md,
            background: T.glass,
            border: `1px solid ${T.glassBorder}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Ico name="shield" size={13} color={T.primary} />
            <Mono size={8} color={T.primary}>BASES LEGAIS · LGPD</Mono>
          </div>
          <p style={{ fontSize: 11, color: T.textMuted, margin: 0, lineHeight: 1.45 }}>
            Cada envio gera log de auditoria com quem enviou, quando e a quem. Links externos
            podem ser revogados a qualquer momento na aba <strong>Compartilhamentos</strong> do paciente.
          </p>
          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            <MetalTag>LGPD</MetalTag>
            <MetalTag>AUDITORIA</MetalTag>
            {scope === 'external' && <MetalTag>CONSENTIMENTO</MetalTag>}
          </div>
        </div>

        <div style={{ marginTop: 22, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn variant="ghost" small onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Btn>
          <Btn
            small
            icon="link"
            onClick={() =>
              onConfirm({
                scope,
                packages: Array.from(packages),
                channels: Array.from(channels),
                expiresInHours: channels.has('link') ? expires : undefined,
                recipientNote: note.trim() || undefined,
              })
            }
            loading={isSubmitting}
            disabled={!canSubmit || isSubmitting}
          >
            Compartilhar
          </Btn>
        </div>
      </Glass>
    </div>
  );
}
