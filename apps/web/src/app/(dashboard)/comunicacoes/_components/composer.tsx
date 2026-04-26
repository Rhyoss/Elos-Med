'use client';

import * as React from 'react';
import { Btn, Mono, Ico, T } from '@dermaos/ui/ds';

const MAX_LENGTH = 4096;

export interface ComposerProps {
  onSend:     (content: string, isInternalNote: boolean) => void;
  onTyping?:  () => void;
  disabled?:  boolean;
  isSending?: boolean;
  placeholder?: string;
}

export function Composer({
  onSend,
  onTyping,
  disabled,
  isSending,
  placeholder = 'Escreva uma mensagem…',
}: ComposerProps) {
  const [value, setValue]   = React.useState('');
  const [isNote, setIsNote] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
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
  }, [canSend, onSend, value, isNote]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      fireSend();
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    if (!onTyping) return;
    if (!typingTimeoutRef.current) {
      onTyping();
      typingTimeoutRef.current = setTimeout(() => { typingTimeoutRef.current = null; }, 1_000);
    }
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
      {/* Toggle nota interna */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
