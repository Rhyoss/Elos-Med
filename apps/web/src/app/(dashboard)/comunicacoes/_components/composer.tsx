'use client';

import * as React from 'react';
import { Btn, Mono, Ico, T } from '@dermaos/ui/ds';
import { TemplatePicker, type PickedTemplate } from './template-picker';

const MAX_LENGTH = 4096;

type ConvChannel = 'whatsapp' | 'instagram' | 'email' | 'sms' | 'webchat' | 'phone';

export interface ComposerProps {
  onSend:     (content: string, isInternalNote: boolean) => void;
  onTyping?:  () => void;
  disabled?:  boolean;
  isSending?: boolean;
  placeholder?: string;
  /** Canal da conversa — passa para o TemplatePicker filtrar templates compatíveis. */
  conversationChannel?: ConvChannel | null;
  /** Sugestão da Aurora — quando definida, exibe banner de supervisão (humano deve aprovar). */
  aiSuggestion?: { content: string; agentName: string } | null;
  onAiSuggestionDismiss?: () => void;
}

export function Composer({
  onSend,
  onTyping,
  disabled,
  isSending,
  placeholder = 'Escreva uma mensagem…',
  conversationChannel,
  aiSuggestion,
  onAiSuggestionDismiss,
}: ComposerProps) {
  const [value, setValue]   = React.useState('');
  const [isNote, setIsNote] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const [pickedTemplate, setPickedTemplate] =
    React.useState<{ id: string; name: string } | null>(null);
  const textareaRef         = React.useRef<HTMLTextAreaElement | null>(null);
  const typingTimeoutRef    = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Auto-expand até 6 linhas. */
  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, 6 * 24);
    el.style.height = `${next}px`;
  }, [value]);

  const canSend = value.trim().length > 0 && value.length <= MAX_LENGTH && !disabled && !isSending;

  const fireSend = React.useCallback(() => {
    if (!canSend) return;
    onSend(value, isNote);
    setValue('');
    setIsNote(false);
    setPickedTemplate(null);
  }, [canSend, onSend, value, isNote]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      fireSend();
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    if (pickedTemplate) setPickedTemplate(null);
    if (!onTyping) return;
    if (!typingTimeoutRef.current) {
      onTyping();
      typingTimeoutRef.current = setTimeout(() => { typingTimeoutRef.current = null; }, 1_000);
    }
  }

  function handlePickTemplate(tpl: PickedTemplate) {
    // Preserva o que já estava digitado, anexando o template ao final.
    const join = value.trim().length > 0 ? `${value.trimEnd()}\n\n` : '';
    const next = `${join}${tpl.body}`;
    setValue(next);
    setPickedTemplate({ id: tpl.id, name: tpl.name });
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function handleAcceptAi() {
    if (!aiSuggestion) return;
    setValue(aiSuggestion.content);
    onAiSuggestionDismiss?.();
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  const count = value.length;
  const overLimit = count > MAX_LENGTH;
  const errorState = overLimit;

  return (
    <div
      style={{
        padding: '10px 18px',
        borderTop: `1px solid ${T.divider}`,
        background: T.glass,
        backdropFilter: `blur(${T.glassBlur}px) saturate(160%)`,
        WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(160%)`,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        flexShrink: 0,
      }}
    >
      {/* Banner de sugestão Aurora — supervisão humana obrigatória */}
      {aiSuggestion && (
        <div
          role="status"
          style={{
            padding: '8px 10px',
            borderRadius: T.r.md,
            background: T.aiBg,
            border: `1px solid ${T.aiBorder}`,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
          }}
        >
          <Ico name="zap" size={14} color={T.ai} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <Mono size={8} color={T.ai} spacing="0.8px">
                AURORA · {aiSuggestion.agentName.toUpperCase()}
              </Mono>
              <Mono size={7} color={T.textMuted}>SUGESTÃO — REVISE ANTES DE ENVIAR</Mono>
            </div>
            <p
              style={{
                fontSize: 11,
                color: T.textPrimary,
                lineHeight: 1.4,
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {aiSuggestion.content}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <Btn small variant="glass" icon="check" onClick={handleAcceptAi}>Usar</Btn>
            <button
              type="button"
              onClick={onAiSuggestionDismiss}
              aria-label="Descartar sugestão"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                color: T.textMuted,
              }}
            >
              <Ico name="x" size={12} color={T.textMuted} />
            </button>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setIsNote((v) => !v)}
          aria-pressed={isNote}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 10px',
            borderRadius: T.r.pill,
            background: isNote ? T.warningBg : T.glass,
            border: `1px solid ${isNote ? T.warningBorder : T.glassBorder}`,
            color: isNote ? T.warning : T.textSecondary,
            fontSize: 10,
            fontFamily: "'IBM Plex Mono', monospace",
            fontWeight: 500,
            letterSpacing: '0.6px',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <Ico name="edit" size={10} color={isNote ? T.warning : T.textSecondary} />
          {isNote ? 'NOTA INTERNA' : 'RESPOSTA'}
        </button>

        <TemplatePicker
          conversationChannel={conversationChannel ?? null}
          onPick={handlePickTemplate}
          disabled={disabled || isNote}
          trigger={
            <button
              type="button"
              disabled={disabled || isNote}
              aria-label="Inserir template"
              title={isNote ? 'Templates não se aplicam a notas internas' : 'Inserir template'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 10px',
                borderRadius: T.r.pill,
                background: pickedTemplate ? T.primaryBg : T.glass,
                border: `1px solid ${pickedTemplate ? T.primaryBorder : T.glassBorder}`,
                color: pickedTemplate ? T.primary : T.textSecondary,
                fontSize: 10,
                fontFamily: "'IBM Plex Mono', monospace",
                fontWeight: 500,
                letterSpacing: '0.6px',
                cursor: disabled || isNote ? 'not-allowed' : 'pointer',
                opacity: disabled || isNote ? 0.45 : 1,
              }}
            >
              <Ico name="copy" size={10} color={pickedTemplate ? T.primary : T.textSecondary} />
              {pickedTemplate ? truncate(pickedTemplate.name, 22) : 'TEMPLATE'}
            </button>
          }
        />

        {/* Agendar envio — backend ainda sem suporte (TODO) */}
        <button
          type="button"
          disabled
          aria-label="Agendar envio (em breve)"
          title="Agendamento de envio chega em breve"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 10px',
            borderRadius: T.r.pill,
            background: T.glass,
            border: `1px dashed ${T.glassBorder}`,
            color: T.textMuted,
            fontSize: 10,
            fontFamily: "'IBM Plex Mono', monospace",
            fontWeight: 500,
            letterSpacing: '0.6px',
            cursor: 'not-allowed',
            opacity: 0.6,
          }}
        >
          <Ico name="clock" size={10} color={T.textMuted} />
          AGENDAR · EM BREVE
        </button>

        <Mono size={8} color={overLimit ? T.danger : T.textMuted}>
          {count}/{MAX_LENGTH}
        </Mono>
        <span style={{ marginLeft: 'auto' }}>
          <Mono size={7}>ENTER ENVIA · SHIFT+ENTER QUEBRA LINHA</Mono>
        </span>
      </div>

      {/* Input + botão */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={isNote ? 'Anotação visível apenas à equipe…' : placeholder}
          disabled={disabled}
          rows={1}
          maxLength={MAX_LENGTH + 100}
          aria-label="Mensagem"
          aria-invalid={errorState || undefined}
          style={{
            flex: 1,
            resize: 'none',
            maxHeight: 144,
            padding: '8px 12px',
            borderRadius: T.r.md,
            background: isNote ? `${T.warning}08` : T.inputBg,
            border: `1px solid ${
              errorState ? T.danger : focused ? T.inputFocus : isNote ? T.warningBorder : T.inputBorder
            }`,
            color: T.textPrimary,
            fontSize: 12,
            fontFamily: "'IBM Plex Sans', sans-serif",
            outline: 'none',
            transition: 'all 0.2s',
            boxShadow: errorState
              ? `0 0 0 3px ${T.dangerBg}`
              : focused
                ? `0 0 0 3px ${T.inputFocusRing}`
                : 'none',
            opacity: disabled ? 0.55 : 1,
          }}
        />
        <Btn small icon="arrowRight" onClick={fireSend} disabled={!canSend} loading={isSending}>
          Enviar
        </Btn>
      </div>
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
