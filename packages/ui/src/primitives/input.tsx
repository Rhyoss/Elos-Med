import * as React from 'react';
import { cn } from '../utils';

/* ── Tipos ──────────────────────────────────────────────────────────────── */

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Mensagem de erro — vermelho, role="alert". Tem prioridade sobre hint/successText. */
  error?: string;
  /** Texto de ajuda neutro abaixo do campo. */
  hint?: string;
  /** Mensagem de sucesso explícita (verde) — alternativa ao boolean `success`. */
  successText?: string;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  /** Marca o campo como válido (ícone + borda verde). */
  success?: boolean;
  /** Estado de carregamento (ex: validação assíncrona). Mostra spinner à direita. */
  isLoading?: boolean;
  onClear?: () => void;
  /** Estilo monoespaçado para inputs de IDs, códigos, datas técnicas. */
  mono?: boolean;
}

/* ── Componente principal ────────────────────────────────────────────────── */

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = 'text',
      label,
      error,
      hint,
      successText,
      iconLeft,
      iconRight,
      success,
      isLoading,
      onClear,
      mono,
      id,
      disabled,
      ...props
    },
    ref,
  ) => {
    const inputId = id ?? React.useId();
    const errorId = `${inputId}-error`;
    const hintId  = `${inputId}-hint`;
    const successId = `${inputId}-success`;

    const describedBy = [
      error && errorId,
      !error && successText && successId,
      !error && !successText && hint && hintId,
    ].filter(Boolean).join(' ') || undefined;

    const isSearch = type === 'search';
    const showRightSlot = isLoading || (success && !error) || iconRight || onClear || isSearch;

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              'text-sm font-medium leading-none',
              disabled ? 'text-muted-foreground cursor-not-allowed' : 'text-foreground',
            )}
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {iconLeft && (
            <span
              className="pointer-events-none absolute left-3 flex items-center text-muted-foreground [&_svg]:size-4"
              aria-hidden="true"
            >
              {iconLeft}
            </span>
          )}

          <input
            id={inputId}
            ref={ref}
            type={type}
            disabled={disabled || isLoading}
            aria-invalid={!!error || undefined}
            aria-busy={isLoading || undefined}
            aria-describedby={describedBy}
            className={cn(
              `flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[15px]
               ring-offset-background
               placeholder:text-muted-foreground
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
               disabled:cursor-not-allowed disabled:opacity-50
               transition-colors`,
              mono && 'font-mono tracking-tight',
              iconLeft && 'pl-9',
              showRightSlot && 'pr-9',
              error && 'border-danger-500 focus-visible:ring-danger-500',
              success && !error && 'border-success-500 focus-visible:ring-success-500',
              className,
            )}
            {...props}
          />

          {/* Spinner de loading — assíncrono, mostrado à direita */}
          {isLoading && (
            <span
              className="pointer-events-none absolute right-3 flex items-center text-muted-foreground"
              aria-hidden="true"
            >
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            </span>
          )}

          {/* Ícone de limpeza para campos de busca */}
          {!isLoading && isSearch && onClear && (
            <button
              type="button"
              onClick={onClear}
              aria-label="Limpar busca"
              className="absolute right-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}

          {!isLoading && iconRight && !onClear && (
            <span
              className="pointer-events-none absolute right-3 flex items-center text-muted-foreground [&_svg]:size-4"
              aria-hidden="true"
            >
              {iconRight}
            </span>
          )}

          {!isLoading && success && !error && (
            <span className="pointer-events-none absolute right-3 flex items-center text-success-500" aria-hidden="true">
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="m20 6-11 11-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          )}
        </div>

        {error && (
          <p id={errorId} role="alert" className="text-[13px] text-danger-500 flex items-center gap-1">
            <svg className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
            </svg>
            {error}
          </p>
        )}

        {!error && successText && (
          <p id={successId} className="text-[13px] text-success-700 flex items-center gap-1">
            <svg className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path d="m20 6-11 11-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {successText}
          </p>
        )}

        {!error && !successText && hint && (
          <p id={hintId} className="text-[13px] text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';

/* ── SearchInput: variant com ícone de lupa embutido ────────────────────── */

export interface SearchInputProps extends Omit<InputProps, 'type' | 'iconLeft'> {
  onClear?: () => void;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ onClear, ...props }, ref) => (
    <Input
      ref={ref}
      type="search"
      onClear={onClear}
      iconLeft={
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" strokeLinecap="round" />
        </svg>
      }
      {...props}
    />
  ),
);
SearchInput.displayName = 'SearchInput';

export { Input, SearchInput };
