import * as React from 'react';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { Circle } from 'lucide-react';
import { cn } from '../utils';

export interface RadioGroupProps
  extends React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root> {
  label?: string;
  error?: string;
  hint?: string;
}

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  RadioGroupProps
>(({ className, label, error, hint, id, ...props }, ref) => {
  const groupId = id ?? React.useId();
  const errorId = `${groupId}-error`;

  return (
    <div className="flex flex-col gap-2 w-full">
      {label && (
        <span className="text-sm font-medium text-foreground" id={`${groupId}-label`}>
          {label}
        </span>
      )}
      <RadioGroupPrimitive.Root
        ref={ref}
        aria-labelledby={label ? `${groupId}-label` : undefined}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={!!error}
        className={cn('grid gap-2', className)}
        {...props}
      />
      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger-500">
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
});
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

export interface RadioGroupItemProps
  extends React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> {
  label?: string;
  description?: string;
}

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  RadioGroupItemProps
>(({ className, label, description, id, disabled, ...props }, ref) => {
  const itemId = id ?? React.useId();
  const descId = `${itemId}-desc`;

  return (
    <div className="flex items-start gap-2.5">
      <RadioGroupPrimitive.Item
        ref={ref}
        id={itemId}
        disabled={disabled}
        aria-describedby={description ? descId : undefined}
        className={cn(
          `aspect-square h-4 w-4 rounded-full border border-input text-primary
           ring-offset-background
           focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
           disabled:cursor-not-allowed disabled:opacity-50
           data-[state=checked]:border-primary
           transition-colors`,
          className,
        )}
        {...props}
      >
        <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
          <Circle className="h-2.5 w-2.5 fill-primary stroke-none" aria-hidden="true" />
        </RadioGroupPrimitive.Indicator>
      </RadioGroupPrimitive.Item>

      {(label || description) && (
        <div className="flex flex-col gap-0.5 leading-none">
          {label && (
            <label
              htmlFor={itemId}
              className={cn(
                'text-sm font-medium cursor-pointer',
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
  );
});
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

export { RadioGroup, RadioGroupItem };
