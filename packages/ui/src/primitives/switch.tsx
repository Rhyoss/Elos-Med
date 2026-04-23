import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '../utils.js';

export interface SwitchProps
  extends React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> {
  label?: string;
  description?: string;
  labelPosition?: 'left' | 'right';
}

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  SwitchProps
>(({ className, label, description, labelPosition = 'right', id, disabled, ...props }, ref) => {
  const switchId = id ?? React.useId();
  const descId = `${switchId}-desc`;

  const control = (
    <SwitchPrimitive.Root
      ref={ref}
      id={switchId}
      disabled={disabled}
      aria-describedby={description ? descId : undefined}
      className={cn(
        `peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent
         transition-colors
         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background
         disabled:cursor-not-allowed disabled:opacity-50
         data-[state=checked]:bg-primary data-[state=unchecked]:bg-input`,
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          `pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0
           transition-transform
           data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0`,
        )}
      />
    </SwitchPrimitive.Root>
  );

  if (!label && !description) return control;

  return (
    <div className="flex items-start gap-2.5">
      {labelPosition === 'left' && (
        <div className="flex flex-col gap-0.5 flex-1">
          <label htmlFor={switchId} className={cn('text-sm font-medium cursor-pointer', disabled && 'opacity-50 cursor-not-allowed')}>
            {label}
          </label>
          {description && (
            <p id={descId} className="text-xs text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      )}

      {control}

      {labelPosition === 'right' && (
        <div className="flex flex-col gap-0.5">
          <label htmlFor={switchId} className={cn('text-sm font-medium cursor-pointer leading-none', disabled && 'opacity-50 cursor-not-allowed')}>
            {label}
          </label>
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
Switch.displayName = SwitchPrimitive.Root.displayName;

export { Switch };
