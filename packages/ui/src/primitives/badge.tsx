import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils';

const badgeVariants = cva(
  `inline-flex items-center gap-1.5 font-medium rounded-full border
   transition-colors focus-visible:outline-none focus-visible:ring-2
   focus-visible:ring-ring focus-visible:ring-offset-1`,
  {
    variants: {
      variant: {
        success:    'border-success-500/30 bg-success-100 text-success-700 dark:bg-success-100/10 dark:text-success-700',
        warning:    'border-warning-500/30 bg-warning-100 text-warning-700 dark:bg-warning-100/10 dark:text-warning-700',
        danger:     'border-danger-500/30 bg-danger-100 text-danger-700 dark:bg-danger-100/10 dark:text-danger-700',
        destructive:'border-danger-500/30 bg-danger-100 text-danger-700 dark:bg-danger-100/10 dark:text-danger-700',
        info:       'border-info-500/30 bg-info-100 text-info-700 dark:bg-info-100/10 dark:text-info-700',
        neutral:    'border-border bg-muted text-muted-foreground',
        outline:    'border-border bg-transparent text-muted-foreground',
        ai:         'border-ai/30 bg-ai-100 text-ai-700 dark:bg-ai-100/10 dark:text-ai-700',
        primary:    'border-primary/30 bg-primary-100 text-primary-700 dark:bg-primary-100/10 dark:text-primary-700',
        gold:       'border-gold-500/30 bg-gold-100 text-gold-700 dark:bg-gold-100/10 dark:text-gold-700',
        /* Module-specific tones — match colors.modules in tokens.ts */
        supply:     'border-supply-500/30 bg-supply-100 text-supply-700 dark:bg-supply-100/10 dark:text-supply-700',
        financial:  'border-financial-500/30 bg-financial-100 text-financial-700 dark:bg-financial-100/10 dark:text-financial-700',
        clinical:   'border-clinical-500/30 bg-clinical-100 text-clinical-700 dark:bg-clinical-100/10 dark:text-clinical-700',
      },
      size: {
        sm: 'px-2 py-0.5 text-[11px]',
        md: 'px-2.5 py-0.5 text-xs',
        lg: 'px-3 py-1 text-[13px]',
      },
    },
    defaultVariants: {
      variant: 'neutral',
      size: 'md',
    },
  },
);

const dotVariants: Record<NonNullable<BadgeProps['variant']>, string> = {
  success:     'bg-success-500',
  warning:     'bg-warning-500',
  danger:      'bg-danger-500',
  destructive: 'bg-danger-500',
  info:        'bg-info-500',
  neutral:     'bg-muted-foreground',
  outline:     'bg-muted-foreground',
  ai:          'bg-ai',
  primary:     'bg-primary',
  gold:        'bg-gold-600',
  supply:      'bg-supply-500',
  financial:   'bg-financial-500',
  clinical:    'bg-clinical-500',
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

function Badge({ className, variant = 'neutral', size, dot, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    >
      {dot && (
        <span
          className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotVariants[variant ?? 'neutral'])}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
