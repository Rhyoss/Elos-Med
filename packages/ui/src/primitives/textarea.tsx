import * as React from 'react';
import { cn } from '../utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  successText?: string;
  showCount?: boolean;
  maxLength?: number;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, successText, showCount, maxLength, id, disabled, value, onChange, ...props }, ref) => {
    const textareaId = id ?? React.useId();
    const errorId = `${textareaId}-error`;
    const hintId  = `${textareaId}-hint`;
    const successId = `${textareaId}-success`;

    const [charCount, setCharCount] = React.useState(
      typeof value === 'string' ? value.length : 0,
    );

    const describedBy = [
      error && errorId,
      !error && successText && successId,
      !error && !successText && hint && hintId,
    ].filter(Boolean).join(' ') || undefined;

    function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
      setCharCount(e.target.value.length);
      onChange?.(e);
    }

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className={cn(
              'text-sm font-medium leading-none',
              disabled ? 'text-muted-foreground cursor-not-allowed' : 'text-foreground',
            )}
          >
            {label}
          </label>
        )}

        <textarea
          id={textareaId}
          ref={ref}
          disabled={disabled}
          maxLength={maxLength}
          value={value}
          onChange={handleChange}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={cn(
            `flex min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-[15px]
             ring-offset-background resize-y leading-relaxed
             placeholder:text-muted-foreground
             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
             disabled:cursor-not-allowed disabled:opacity-50
             transition-colors`,
            error && 'border-danger-500 focus-visible:ring-danger-500',
            successText && !error && 'border-success-500 focus-visible:ring-success-500',
            className,
          )}
          {...props}
        />

        <div className="flex justify-between items-start gap-2">
          <div className="flex-1">
            {error && (
              <p id={errorId} role="alert" className="text-[13px] text-danger-500">
                {error}
              </p>
            )}
            {!error && successText && (
              <p id={successId} className="text-[13px] text-success-700">
                {successText}
              </p>
            )}
            {!error && !successText && hint && (
              <p id={hintId} className="text-[13px] text-muted-foreground">
                {hint}
              </p>
            )}
          </div>
          {showCount && maxLength && (
            <span
              className={cn(
                'text-xs text-muted-foreground shrink-0',
                charCount >= maxLength && 'text-danger-500',
              )}
              aria-live="polite"
              aria-atomic="true"
            >
              {charCount}/{maxLength}
            </span>
          )}
        </div>
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea };
