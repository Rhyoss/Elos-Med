'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../utils';

const SheetRoot = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 bg-bg-overlay/60 backdrop-blur-sm data-[state=open]:animate-fade-in',
      className,
    )}
    style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
    {...props}
  />
));
SheetOverlay.displayName = 'SheetOverlay';

export interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  side?: 'right' | 'left' | 'top' | 'bottom';
}

const sideClasses = {
  right:  'inset-y-0 right-0 h-full w-full max-w-[400px] data-[state=open]:animate-slide-in-from-right data-[state=closed]:animate-slide-out-to-right',
  left:   'inset-y-0 left-0 h-full w-full max-w-[400px]',
  top:    'inset-x-0 top-0 w-full',
  bottom: 'inset-x-0 bottom-0 w-full',
};

const sideStyles: Record<string, React.CSSProperties> = {
  right:  { top: 0, right: 0, bottom: 0, height: '100%', width: '100%', maxWidth: 460 },
  left:   { top: 0, left: 0, bottom: 0, height: '100%', width: '100%', maxWidth: 460 },
  top:    { top: 0, left: 0, right: 0, width: '100%' },
  bottom: { bottom: 0, left: 0, right: 0, width: '100%' },
};

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(({ className, children, side = 'right', ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed flex flex-col bg-card border shadow-xl focus:outline-none',
        sideClasses[side],
        className,
      )}
      style={{
        position: 'fixed',
        zIndex: 400,
        display: 'flex',
        flexDirection: 'column' as const,
        background: 'hsl(0 0% 100%)',
        borderTop: '1px solid hsl(0 0% 90%)',
        borderRight: '1px solid hsl(0 0% 90%)',
        borderBottom: '1px solid hsl(0 0% 90%)',
        borderLeft: '1px solid hsl(0 0% 90%)',
        boxShadow: '0 24px 56px rgba(0,0,0,0.14), 0 6px 14px rgba(0,0,0,0.06)',
        ...sideStyles[side],
      }}
      aria-describedby={undefined}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        aria-label="Fechar painel"
        style={{
          position: 'absolute',
          right: 16,
          top: 16,
          padding: 6,
          borderRadius: 6,
          border: 'none',
          background: 'transparent',
          color: 'hsl(0 0% 55%)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 0.15s, background 0.15s',
          zIndex: 10,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'hsl(0 0% 95%)';
          e.currentTarget.style.color = 'hsl(0 0% 20%)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'hsl(0 0% 55%)';
        }}
      >
        <X style={{ width: 16, height: 16 }} aria-hidden="true" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = 'SheetContent';

/* Cabeçalho fixo */
const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1.5 px-6 py-5 border-b shrink-0', className)} {...props} />
);
SheetHeader.displayName = 'SheetHeader';

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold', className)}
    {...props}
  />
));
SheetTitle.displayName = 'SheetTitle';

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
SheetDescription.displayName = 'SheetDescription';

/* Conteúdo com scroll */
const SheetBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex-1 overflow-y-auto px-6 py-4', className)} {...props} />
);
SheetBody.displayName = 'SheetBody';

/* Rodapé fixo */
const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex justify-end gap-2 px-6 py-4 border-t shrink-0', className)}
    {...props}
  />
);
SheetFooter.displayName = 'SheetFooter';

export {
  SheetRoot,
  SheetTrigger,
  SheetClose,
  SheetPortal,
  SheetOverlay,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
};
