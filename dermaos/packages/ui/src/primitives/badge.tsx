import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 font-medium rounded-full border transition-colors whitespace-nowrap',
  {
    variants: {
      variant: {
        success:    'border-success-500/25 bg-success-100 text-success-700 dark:bg-success-100/10 dark:text-success-700',
        warning:    'border-warning-500/25 bg-warning-100 text-warning-700 dark:bg-warning-100/10 dark:text-warning-700',
        danger:     'border-danger-500/25 bg-danger-100 text-danger-700 dark:bg-danger-100/10 dark:text-danger-700',
        destructive:'border-danger-500/25 bg-danger-100 text-danger-700 dark:bg-danger-100/10 dark:text-danger-700',
        info:       'border-info-500/25 bg-info-100 text-info-700 dark:bg-info-100/10 dark:text-info-700',
        neutral:    'border-border bg-muted text-muted-foreground',
        secondary:  'border-border bg-muted text-muted-foreground',
        ai:         'border-ai/25 bg-ai-100 text-ai-700 dark:bg-ai-100/10 dark:text-ai-700',
        primary:    'border-primary/25 bg-primary-100 text-primary-700 dark:bg-primary-100/10 dark:text-primary-700',
        default:    'border-primary/25 bg-primary-100 text-primary-700 dark:bg-primary-100/10 dark:text-primary-700',
        gold:       'border-gold-500/25 bg-gold-100 text-gold-700 dark:bg-gold-100/10 dark:text-gold-700',
        outline:    'border-border bg-transparent text-foreground',
        /* Sólidos — para destaques fortes */
        'solid-primary': 'border-transparent bg-primary text-primary-foreground',
        'solid-danger':  'border-transparent bg-danger text-danger-foreground',
        'solid-gold':    'border-transparent bg-gold-600 text-gold-foreground',
        'solid-ai':      'border-transparent bg-ai text-ai-foreground',
      },
      size: {
        sm: 'px-2 py-0.5 text-xs h-5',
        md: 'px-2.5 py-0.5 text-xs h-6',
        lg: 'px-3 py-1 text-sm h-7',
      },
    },
    defaultVariants: {
      variant: 'neutral',
      size: 'md',
    },
  },
);

const dotVariants: Record<string, string> = {
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger:  'bg-danger-500',
  destructive: 'bg-danger-500',
  info:    'bg-info-500',
  neutral: 'bg-muted-foreground',
  secondary: 'bg-muted-foreground',
  ai:      'bg-ai',
  primary: 'bg-primary',
  default: 'bg-primary',
  gold:    'bg-gold-600',
  outline: 'bg-muted-foreground',
  'solid-primary': 'bg-primary-200',
  'solid-danger':  'bg-danger-100',
  'solid-gold':    'bg-gold-200',
  'solid-ai':      'bg-ai-100',
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Renderiza um indicador visual (ponto). Quando `pulse`, anima como notificação ao vivo. */
  dot?: boolean;
  pulse?: boolean;
}

function Badge({ className, variant = 'neutral', size, dot, pulse, children, ...props }: BadgeProps) {
  const dotKey = (variant ?? 'neutral') as string;
  return (
    <span
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    >
      {(dot || pulse) && (
        <span className="relative flex shrink-0 h-1.5 w-1.5" aria-hidden="true">
          {pulse && (
            <span className={cn(
              'absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping',
              dotVariants[dotKey] ?? 'bg-muted-foreground',
            )} />
          )}
          <span className={cn(
            'relative inline-flex h-1.5 w-1.5 rounded-full',
            dotVariants[dotKey] ?? 'bg-muted-foreground',
          )} />
        </span>
      )}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
