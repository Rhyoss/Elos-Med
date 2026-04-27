import * as React from 'react';
import { cn } from '../utils';

/* ── Tipos ──────────────────────────────────────────────────────────────── */

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  success?: boolean;
  onClear?: () => void;
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
      iconLeft,
      iconRight,
      success,
      onClear,
      id,
      disabled,
      ...props
    },
    ref,
  ) => {
    const inputId = id ?? React.useId();
    const errorId = `${inputId}-error`;
    const hintId  = `${inputId}-hint`;

    const describedBy = [error && errorId, hint && !error && hintId]
      .filter(Boolean)
      .join(' ') || undefined;

    const isSearch = type === 'search';

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
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            className={cn(
              `flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm
               ring-offset-background
               placeholder:text-muted-foreground
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
               disabled:cursor-not-allowed disabled:opacity-50
               transition-colors`,
              iconLeft && 'pl-9',
              (iconRight || onClear || isSearch) && 'pr-9',
              error && 'border-danger-500 focus-visible:ring-danger-500',
              success && !error && 'border-success-500 focus-visible:ring-success-500',
              className,
            )}
            {...props}
          />

          {/* Ícone de limpeza para campos de busca */}
          {isSearch && onClear && (
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

          {iconRight && !onClear && (
            <span
              className="pointer-events-none absolute right-3 flex items-center text-muted-foreground [&_svg]:size-4"
              aria-hidden="true"
            >
              {iconRight}
            </span>
          )}

          {success && !error && (
            <span className="pointer-events-none absolute right-3 flex items-center text-success-500" aria-hidden="true">
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="m20 6-11 11-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          )}
        </div>

        {error && (
          <p id={errorId} role="alert" className="text-xs text-danger-500 flex items-center gap-1">
            <svg className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
            </svg>
            {error}
          </p>
        )}

        {hint && !error && (
          <p id={hintId} className="text-xs text-muted-foreground">
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
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
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
