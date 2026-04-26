import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils';

/* ── Variantes do card ───────────────────────────────────────────────────── */

const cardVariants = cva(
  'rounded-lg border bg-card text-card-foreground transition-shadow duration-200',
  {
    variants: {
      variant: {
        /* Padrão — leve, para a maioria dos contextos */
        default:     'shadow-sm border-border/70',
        /* Interativo — hover lift premium */
        interactive: 'shadow-sm border-border/70 hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/20 transition-all cursor-pointer',
        /* Métrica — focado em dados, com sutil destaque */
        metric:      'shadow-sm border-border/70',
        /* Elevado — para o card hero da página (próximo paciente, alerta crítico) */
        elevated:    'shadow-md border-border/60',
        /* Plano — sem nada, só um container */
        flat:        'border-0 shadow-none bg-transparent',
        /* Outline — sem sombra, só borda — usado em listas / sub-cards */
        outline:     'shadow-none border-border',
        /* Destaque com faixa lateral primária */
        accent:      'shadow-sm border-border/70 relative overflow-hidden before:content-[""] before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-primary',
        /* Destaque dourado — uso especial (premium / VIP / convênios) */
        gold:        'shadow-sm border-gold-200 bg-gold-50/40 dark:bg-gold-100/5 relative overflow-hidden before:content-[""] before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-gold-600',
        /* Crítico — para alertas prioritários */
        critical:    'shadow-sm border-danger-500/30 bg-danger-100/40 dark:bg-danger-100/5',
      },
      padding: {
        none: 'p-0',
        sm:   '[&>[data-card-header]]:p-4 [&>[data-card-header]]:pb-0 [&>[data-card-content]]:p-4 [&>[data-card-footer]]:p-4 [&>[data-card-footer]]:pt-0',
        md:   '',
      },
    },
    defaultVariants: {
      variant: 'default',
      padding: 'md',
    },
  },
);

/* ── Card raiz ────────────────────────────────────────────────────────────── */

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, padding }), className)}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

/* ── Seções ───────────────────────────────────────────────────────────────── */

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-card-header=""
      className={cn('flex flex-col gap-1.5 p-5 pb-3', className)}
      {...props}
    />
  ),
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-base font-semibold leading-tight tracking-tight text-foreground', className)}
      {...props}
    />
  ),
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-muted-foreground leading-relaxed', className)} {...props} />
  ),
);
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-card-content="" className={cn('p-5 pt-0', className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-card-footer=""
      className={cn('flex items-center p-5 pt-3 border-t border-border/60', className)}
      {...props}
    />
  ),
);
CardFooter.displayName = 'CardFooter';

/* ── Card Toolbar — barra de ações no header ─────────────────────────────── */

const CardToolbar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center justify-between gap-3 p-5 pb-3', className)}
      {...props}
    />
  ),
);
CardToolbar.displayName = 'CardToolbar';

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardToolbar };
