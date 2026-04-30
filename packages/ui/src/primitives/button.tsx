import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils';

/* ── Variants ────────────────────────────────────────────────────────────
   - primary / default: forest green, ações principais não-destrutivas
   - gold:              alias legacy → burgundy (accent Quite Clear)
   - secondary:         botão neutro de baixa ênfase
   - outline:           contorno, ações alternativas
   - ghost:             apenas hover, navegação e icon-buttons
   - glass:             superfície glass — usar em shells/cards executivos
   - link:              parece um link inline, sem padding
   - destructive:       ações irreversíveis (borda + texto vermelho)             */

const buttonVariants = cva(
  `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md
   font-medium tracking-tight
   transition-[background,color,border-color,box-shadow] duration-150
   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
   focus-visible:ring-offset-2 focus-visible:ring-offset-background
   disabled:pointer-events-none disabled:opacity-50
   [&_svg]:pointer-events-none [&_svg]:shrink-0`,
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground shadow-sm hover:bg-primary-700 active:bg-primary-800',
        default:
          'bg-primary text-primary-foreground shadow-sm hover:bg-primary-700 active:bg-primary-800',
        gold:
          'bg-gold-600 text-gold-foreground shadow-sm hover:bg-gold-700 active:bg-gold-800',
        outline:
          'border border-input bg-background text-foreground hover:bg-hover active:bg-hover',
        secondary:
          'border border-input bg-muted text-foreground hover:bg-hover active:bg-hover',
        ghost:
          'bg-transparent text-foreground hover:bg-hover active:bg-hover',
        glass:
          `border border-white/60 bg-white/55 text-foreground backdrop-blur-md
           shadow-sm hover:bg-white/72 active:bg-white/80`,
        link:
          `bg-transparent text-primary underline-offset-4 hover:underline
           focus-visible:underline px-0 py-0 h-auto`,
        destructive:
          `border border-danger-500 bg-transparent text-danger-500
           hover:bg-danger-100 active:bg-danger-100
           dark:border-danger-700 dark:text-danger-700 dark:hover:bg-danger-100/10`,
      },
      size: {
        sm:        'h-8 px-3 text-[13px] [&_svg]:size-3.5',
        md:        'h-10 px-4 py-2 text-sm [&_svg]:size-4',
        lg:        'h-12 px-6 text-base [&_svg]:size-5',
        icon:      'h-10 w-10 [&_svg]:size-4',
        'icon-sm': 'h-8 w-8 [&_svg]:size-3.5',
        'icon-lg': 'h-12 w-12 [&_svg]:size-5',
      },
    },
    compoundVariants: [
      // `link` ignores size padding entirely
      { variant: 'link', size: 'sm', className: 'h-auto px-0 py-0' },
      { variant: 'link', size: 'md', className: 'h-auto px-0 py-0' },
      { variant: 'link', size: 'lg', className: 'h-auto px-0 py-0 text-base' },
    ],
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
  /** Loading text — default: silencioso (apenas spinner). Passe string para mostrar. */
  loadingText?: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

const Spinner = ({ className }: { className?: string }) => (
  <span
    className={cn(
      'h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent',
      className,
    )}
    aria-hidden="true"
  />
);

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      isLoading,
      loadingText,
      leadingIcon,
      trailingIcon,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button';

    // Quando `asChild`, o filho deve ser um elemento único — não podemos
    // injetar spinner/ícones; respeitamos a API e passamos children intacto.
    const content = asChild ? (
      children
    ) : (
      <>
        {isLoading ? <Spinner /> : leadingIcon}
        {isLoading && loadingText ? loadingText : children}
        {!isLoading && trailingIcon}
      </>
    );

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled ?? isLoading}
        aria-busy={isLoading || undefined}
        aria-disabled={disabled ?? isLoading}
        {...props}
      >
        {content}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
