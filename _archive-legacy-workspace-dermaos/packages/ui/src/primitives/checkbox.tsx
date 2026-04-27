import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';
import { cn } from '../utils';

export interface CheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  label?: string;
  description?: string;
  error?: string;
  indeterminate?: boolean;
}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, label, description, error, indeterminate, id, disabled, ...props }, ref) => {
  const checkboxId = id ?? React.useId();
  const descId = `${checkboxId}-desc`;
  const errorId = `${checkboxId}-error`;

  const describedBy = [description && descId, error && errorId]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-2.5">
        <CheckboxPrimitive.Root
          ref={ref}
          id={checkboxId}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          checked={indeterminate ? 'indeterminate' : props.checked}
          className={cn(
            `peer h-4 w-4 shrink-0 rounded-sm border border-input
             ring-offset-background
             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
             disabled:cursor-not-allowed disabled:opacity-50
             data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground
             data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:text-primary-foreground
             transition-colors`,
            error && 'border-danger-500',
            className,
          )}
          {...props}
        >
          <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
            {indeterminate ? (
              <Minus className="h-3 w-3" aria-hidden="true" />
            ) : (
              <Check className="h-3 w-3" aria-hidden="true" />
            )}
          </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>

        {(label || description) && (
          <div className="flex flex-col gap-0.5 leading-none">
            {label && (
              <label
                htmlFor={checkboxId}
                className={cn(
                  'text-sm font-medium cursor-pointer select-none',
                  disabled && 'opacity-50 cursor-not-allowed',
                )}
              >
                {label}
              </label>
            )}
            {description && (
              <p id={descId} className="text-xs text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        )}
      </div>

      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger-500 ml-6.5">
          {error}
        </p>
      )}
    </div>
  );
});
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
