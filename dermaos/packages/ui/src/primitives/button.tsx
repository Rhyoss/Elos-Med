import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils';

const buttonVariants = cva(
  `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium
   transition-[background-color,box-shadow,color,transform] duration-150
   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
   focus-visible:ring-offset-2 focus-visible:ring-offset-background
   disabled:pointer-events-none disabled:opacity-50
   active:translate-y-px
   [&_svg]:pointer-events-none [&_svg]:shrink-0`,
  {
    variants: {
      variant: {
        /* Ações principais não-destrutivas */
        primary:
          'bg-primary text-primary-foreground shadow-sm hover:bg-primary-700 hover:shadow-md active:bg-primary-800',
        /* Alias para primary (mantém compatibilidade shadcn) */
        default:
          'bg-primary text-primary-foreground shadow-sm hover:bg-primary-700 hover:shadow-md active:bg-primary-800',
        /* Identidade de marca, CTAs especiais */
        gold:
          'bg-gold-600 text-gold-foreground shadow-sm hover:bg-gold-700 hover:shadow-md active:bg-gold-800',
        /* Ações secundárias */
        outline:
          'border border-input bg-background text-foreground hover:bg-hover hover:border-primary/30 active:bg-hover',
        /* Subtle — preenchido neutro, ações terciárias com mais peso que ghost */
        subtle:
          'bg-muted text-foreground hover:bg-hover active:bg-bg-selected/50',
        /* Secondary — alias de subtle (compatibilidade shadcn/ui) */
        secondary:
          'bg-muted text-foreground hover:bg-hover active:bg-bg-selected/50',
        /* Ações terciárias, navegação */
        ghost:
          'bg-transparent text-foreground hover:bg-hover active:bg-hover',
        /* Link visual (usado como botão por questão de a11y) */
        link:
          'bg-transparent text-primary-700 underline-offset-4 hover:underline p-0 h-auto',
        /* Ações irreversíveis — borda + texto vermelho */
        destructive:
          'border border-danger-500 bg-transparent text-danger-700 hover:bg-danger-100 active:bg-danger-100 dark:border-danger-700 dark:text-danger-700 dark:hover:bg-danger-100/10',
        /* Destrutivo sólido — confirmação final */
        'destructive-solid':
          'bg-danger text-danger-foreground shadow-sm hover:bg-danger-700 hover:shadow-md active:bg-danger-700',
      },
      size: {
        xs:  'h-7 px-2.5 text-xs gap-1.5 [&_svg]:size-3.5',
        sm:  'h-8 px-3 text-xs [&_svg]:size-3.5',
        md:  'h-10 px-4 py-2 [&_svg]:size-4',
        lg:  'h-11 px-6 text-base [&_svg]:size-5',
        xl:  'h-12 px-8 text-base font-semibold [&_svg]:size-5',
        icon: 'h-10 w-10 [&_svg]:size-4',
        'icon-sm': 'h-8 w-8 [&_svg]:size-3.5',
      },
    },
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
  loadingText?: string;
}

const Spinner = ({ className }: { className?: string }) => (
  <span
    className={cn('h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent', className)}
    aria-hidden="true"
  />
);

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, isLoading, loadingText, children, disabled, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button';

    /* Quando asChild, não é seguro injetar múltiplos children — preservamos o child */
    if (asChild) {
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        >
          {children}
        </Comp>
      );
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled ?? isLoading}
        aria-busy={isLoading || undefined}
        aria-disabled={(disabled ?? isLoading) || undefined}
        {...props}
      >
        {isLoading ? (
          <>
            <Spinner />
            <span>{loadingText ?? 'Processando...'}</span>
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
