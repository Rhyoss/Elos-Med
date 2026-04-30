import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils';

/* ── Card variants ───────────────────────────────────────────────────────
   Surface taxonomy:
   - solid:        white opaque card. Default for clinical density —
                   prontuário, prescrição, evolução, tabelas, formulários.
   - default:      same as solid (alias for shadcn-compat).
   - glass:        translucent + backdrop-blur. Use in shells, executive
                   dashboards and overlays — NOT for long-form reading.
   - metal:        brushed-nickel gradient. Hero/CTA only — premium accent.
   - interactive:  solid + hover elevation. For clickable cards.
   - metric:       solid (kept as alias — was the dashboard KPI tile).
   - flat:         no border / no shadow / transparent. Sectioning helper. */

const cardVariants = cva(
  'rounded-lg border text-card-foreground transition-shadow',
  {
    variants: {
      variant: {
        solid:       'border-border bg-card shadow-sm',
        default:     'border-border bg-card shadow-sm',
        glass:       [
          'border-[color:var(--ds-glass-border)]',
          'bg-[color:var(--ds-glass-bg)]',
          'shadow-[var(--ds-glass-shadow)]',
          'backdrop-blur-[var(--ds-glass-blur)]',
          'backdrop-saturate-[var(--ds-glass-saturate)]',
        ].join(' '),
        metal:       [
          'border-[color:var(--ds-metal-border)]',
          'bg-[image:var(--ds-metal-grad)]',
          'shadow-md',
        ].join(' '),
        interactive: 'border-border bg-card shadow-sm hover:shadow-md cursor-pointer',
        metric:      'border-border bg-card shadow-sm',
        flat:        'border-0 shadow-none bg-transparent',
      },
      padding: {
        none: 'p-0',
        sm:   'p-4',
        md:   'p-6',
        lg:   'p-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      padding: 'none',
    },
  },
);

/* ── Card root ────────────────────────────────────────────────────────── */

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

/* ── Sections ─────────────────────────────────────────────────────────── */

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-1.5 p-6 pb-0', className)} {...props} />
  ),
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-base font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  ),
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
  ),
);
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6', className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center p-6 pt-0', className)}
      {...props}
    />
  ),
);
CardFooter.displayName = 'CardFooter';

/* ── Convenience aliases ─────────────────────────────────────────────────
   Allow callsites to import GlassCard / SolidCard / MetalCard directly when
   they want the surface intent to read at the call site. They're thin
   wrappers — props identical to Card except `variant` is preset. */

type SurfaceCardProps = Omit<CardProps, 'variant'>;

const GlassCard = React.forwardRef<HTMLDivElement, SurfaceCardProps>(
  (props, ref) => <Card ref={ref} variant="glass" {...props} />,
);
GlassCard.displayName = 'GlassCard';

const SolidCard = React.forwardRef<HTMLDivElement, SurfaceCardProps>(
  (props, ref) => <Card ref={ref} variant="solid" {...props} />,
);
SolidCard.displayName = 'SolidCard';

const MetalCard = React.forwardRef<HTMLDivElement, SurfaceCardProps>(
  (props, ref) => <Card ref={ref} variant="metal" {...props} />,
);
MetalCard.displayName = 'MetalCard';

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  GlassCard,
  SolidCard,
  MetalCard,
  cardVariants,
};
