import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils.js';

const buttonVariants = cva(
  `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium
   transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
   focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50
   [&_svg]:pointer-events-none [&_svg]:shrink-0`,
  {
    variants: {
      variant: {
        /* Ações principais não-destrutivas */
        primary:
          'bg-primary text-primary-foreground hover:bg-primary-700 active:bg-primary-800',
        /* Alias para primary (mantém compatibilidade shadcn) */
        default:
          'bg-primary text-primary-foreground hover:bg-primary-700 active:bg-primary-800',
        /* Identidade de marca, CTAs especiais */
        gold:
          'bg-gold-600 text-gold-foreground hover:bg-gold-700 active:bg-gold-800',
        /* Ações secundárias */
        outline:
          'border border-input bg-background text-foreground hover:bg-hover active:bg-hover',
        /* Ações terciárias, navegação */
        ghost:
          'bg-transparent text-foreground hover:bg-hover active:bg-hover',
        /* Ações irreversíveis — borda + texto vermelho */
        destructive:
          'border border-danger-500 bg-transparent text-danger-500 hover:bg-danger-100 active:bg-danger-100 dark:border-danger-700 dark:text-danger-700 dark:hover:bg-danger-100/10',
      },
      size: {
        sm:  'h-8 px-3 text-xs [&_svg]:size-3.5',
        md:  'h-10 px-4 py-2 [&_svg]:size-4',
        lg:  'h-11 px-6 text-base [&_svg]:size-5',
        icon: 'h-10 w-10 [&_svg]:size-4',
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
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, isLoading, children, disabled, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled ?? isLoading}
        aria-busy={isLoading}
        aria-disabled={disabled ?? isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
              aria-hidden="true"
            />
            Processando...
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
