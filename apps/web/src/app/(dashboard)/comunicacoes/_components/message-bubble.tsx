'use client';

import { Mono, Ico, T } from '@dermaos/ui/ds';
import { formatClockTime } from '../_lib/relative-time';

export interface MessageBubbleProps {
  message: {
    id:             string;
    senderType:     'patient' | 'user' | 'ai_agent' | 'system';
    senderName:     string | null;
    contentType:    'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'template' | 'interactive';
    content:        string | null;
    mediaUrl:       string | null;
    status:         'pending' | 'sent' | 'delivered' | 'read' | 'failed';
    createdAt:      Date;
    isInternalNote: boolean;
  };
  onRetry?: (messageId: string) => void;
}

function StatusIcon({ status }: { status: MessageBubbleProps['message']['status'] }) {
  switch (status) {
    case 'pending':
      return <Ico name="clock" size={11} color={T.textMuted} />;
    case 'sent':
      return <Ico name="check" size={11} color={T.textMuted} />;
    case 'delivered':
      return <Ico name="check" size={11} color={T.textMuted} sw={2.4} />;
    case 'read':
      return <Ico name="check" size={11} color={T.primary} sw={2.4} />;
    case 'failed':
      return <Ico name="alert" size={11} color={T.danger} />;
    default:
      return null;
  }
}

export function MessageBubble({ message, onRetry }: MessageBubbleProps) {
  /* Mensagens "system" — separador centralizado. */
  if (message.senderType === 'system') {
    return (
      <div style={{ margin: '8px 0', display: 'flex', justifyContent: 'center' }}>
        <span
          style={{
            padding: '3px 12px',
            borderRadius: T.r.pill,
            background: T.glass,
            border: `1px solid ${T.glassBorder}`,
            fontSize: 10,
            color: T.textMuted,
            fontFamily: "'IBM Plex Mono', monospace",
            letterSpacing: '0.6px',
          }}
        >
          {message.content}
        </span>
      </div>
    );
  }

  const isInbound = message.senderType === 'patient';
  const isAI      = message.senderType === 'ai_agent';
  const isNote    = message.isInternalNote;

  /* Cores e geometry da bolha — match S04 reference. */
  let bubbleBg: string;
  let bubbleBorder: string;
  let radius: string;
  if (isInbound) {
    bubbleBg = T.glass;
    bubbleBorder = T.glassBorder;
    radius = `${T.r.sm}px ${T.r.lg}px ${T.r.lg}px ${T.r.lg}px`;
  } else if (isAI) {
    bubbleBg = T.aiBg;
    bubbleBorder = T.aiBorder;
    radius = `${T.r.lg}px ${T.r.sm}px ${T.r.lg}px ${T.r.lg}px`;
  } else if (isNote) {
    bubbleBg = T.warningBg;
    bubbleBorder = T.warningBorder;
    radius = `${T.r.lg}px ${T.r.sm}px ${T.r.lg}px ${T.r.lg}px`;
  } else {
    bubbleBg = T.primaryBg;
    bubbleBorder = T.primaryBorder;
    radius = `${T.r.lg}px ${T.r.sm}px ${T.r.lg}px ${T.r.lg}px`;
  }

  return (
    <div
      style={{
        marginBottom: 10,
        display: 'flex',
        flexDirection: isInbound ? 'row' : 'row-reverse',
        gap: 7,
        alignItems: 'flex-end',
      }}
    >
      {isAI && (
        <div
          aria-hidden
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: T.aiBg,
            border: `1px solid ${T.aiBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Ico name="zap" size={10} color={T.ai} />
        </div>
      )}

      <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column' }}>
        {/* Sender / nota header */}
        {(isAI || (!isInbound && message.senderName) || isNote) && (
          <div style={{ display: 'flex', gap: 5, marginBottom: 2, fontSize: 10, color: T.textMuted, alignItems: 'center', justifyContent: isInbound ? 'flex-start' : 'flex-end' }}>
            {isAI && (
              <span
                style={{
                  padding: '0 6px',
                  borderRadius: 3,
                  background: T.aiBg,
                  color: T.ai,
                  fontSize: 8,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontWeight: 600,
                  letterSpacing: '0.6px',
                }}
              >
                AURORA IA
              </span>
            )}
            {!isInbound && !isAI && message.senderName && (
              <span style={{ fontSize: 10, color: T.textMuted }}>{message.senderName}</span>
            )}
            {isNote && (
              <span
                style={{
                  padding: '0 6px',
                  borderRadius: 3,
                  background: T.warningBg,
                  color: T.warning,
                  fontSize: 8,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontWeight: 600,
                  letterSpacing: '0.6px',
                }}
              >
                NOTA INTERNA
              </span>
            )}
          </div>
        )}

        {/* Bubble */}
        <div
          style={{
            padding: '8px 12px',
            borderRadius: radius,
            background: bubbleBg,
            border: `1px solid ${bubbleBorder}`,
          }}
        >
          {message.contentType === 'image' && message.mediaUrl && (
            <img
              src={message.mediaUrl}
              alt={message.content ?? 'imagem'}
              style={{ marginBottom: 4, maxHeight: 256, borderRadius: T.r.md, display: 'block' }}
            />
          )}
          {message.contentType === 'document' && message.mediaUrl && (
            <a
              href={message.mediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                marginBottom: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: T.primary,
                textDecoration: 'underline',
                fontSize: 12,
              }}
            >
              <Ico name="file" size={12} color={T.primary} />
              Ver documento
            </a>
          )}
          {message.content && (
            <p
              style={{
                fontSize: 12,
                color: T.textPrimary,
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {message.content}
            </p>
          )}

          <div
            style={{
              marginTop: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 4,
            }}
          >
            <Mono size={7}>
              {formatClockTime(message.createdAt)}
              {isAI && ' · AURORA IA'}
            </Mono>
            {!isInbound && <StatusIcon status={message.status} />}
          </div>
        </div>

        {message.status === 'failed' && !isInbound && onRetry && (
          <button
            type="button"
            onClick={() => onRetry(message.id)}
            style={{
              marginTop: 4,
              alignSelf: 'flex-end',
              fontSize: 10,
              color: T.danger,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 0,
              fontFamily: "'IBM Plex Sans', sans-serif",
            }}
          >
            Reenviar
          </button>
        )}
      </div>
    </div>
  );
}

/** Separador inserido quando atendimento transita de IA para humano. */
export function AITransitionSeparator() {
  return (
    <div
      role="separator"
      style={{
        margin: '14px 0',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <div style={{ flex: 1, height: 1, background: T.divider }} />
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 10px',
          borderRadius: T.r.pill,
          background: T.aiBg,
          border: `1px solid ${T.aiBorder}`,
          fontSize: 10,
          color: T.ai,
          fontFamily: "'IBM Plex Mono', monospace",
          fontWeight: 500,
          letterSpacing: '0.6px',
        }}
      >
        <Ico name="zap" size={10} color={T.ai} />
        TRANSFERIDO PARA HUMANO
      </span>
      <div style={{ flex: 1, height: 1, background: T.divider }} />
    </div>
  );
}
