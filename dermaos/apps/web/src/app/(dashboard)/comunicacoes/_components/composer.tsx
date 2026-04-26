'use client';

import * as React from 'react';
import { Button } from '@dermaos/ui';
import { Send, StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  placeholder = 'Digite uma mensagem…',
}: ComposerProps) {
  const [value, setValue]         = React.useState('');
  const [isNote, setIsNote]       = React.useState(false);
  const textareaRef               = React.useRef<HTMLTextAreaElement | null>(null);
  const typingTimeoutRef          = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-expand até 6 linhas
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
    // Throttle client-side também — mínimo 1s entre emissões
    if (!typingTimeoutRef.current) {
      onTyping();
      typingTimeoutRef.current = setTimeout(() => {
        typingTimeoutRef.current = null;
      }, 1_000);
    }
  }

  const count = value.length;
  const overLimit = count > MAX_LENGTH;

  return (
    <div className="border-t border-border bg-background p-3">
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsNote((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors',
            isNote
              ? 'bg-warning-100 text-warning-700'
              : 'bg-muted text-muted-foreground hover:bg-muted/70',
          )}
          aria-pressed={isNote}
        >
          <StickyNote className="h-3 w-3" aria-hidden="true" />
          {isNote ? 'Nota interna' : 'Resposta'}
        </button>
      </div>

      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={isNote ? 'Anotação visível apenas à equipe…' : placeholder}
          disabled={disabled}
          rows={1}
          maxLength={MAX_LENGTH + 100}
          className={cn(
            'max-h-36 flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm',
            'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary',
            isNote && 'border-warning-500/50 bg-warning-50/50',
            overLimit && 'border-danger-500',
          )}
          aria-label="Mensagem"
        />
        <Button
          onClick={fireSend}
          disabled={!canSend}
          size="sm"
          aria-label="Enviar mensagem"
          className="flex-none"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Enter envia · Shift+Enter quebra linha</span>
        <span className={overLimit ? 'text-danger-600' : ''}>
          {count}/{MAX_LENGTH}
        </span>
      </div>
    </div>
  );
}
