'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../utils';
import { Button } from './button';
import { Input } from './input';

/* ── Primitivos base ─────────────────────────────────────────────────────── */

const DialogRoot = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      `fixed inset-0 bg-bg-overlay/70 backdrop-blur-sm
       data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-in`,
      className,
    )}
    style={{ zIndex: 'var(--z-overlay)' }}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        `fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
         w-full max-w-lg max-h-[90vh] overflow-y-auto
         bg-card rounded-lg border shadow-xl
         data-[state=open]:animate-fade-in`,
        className,
      )}
      style={{ zIndex: 'var(--z-modal)' }}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        className={cn(
          `absolute right-4 top-4 rounded-md p-1 text-muted-foreground
           hover:text-foreground hover:bg-hover transition-colors
           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`,
        )}
        aria-label="Fechar"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1.5 p-6 pb-0 pr-10', className)} {...props} />
);
DialogHeader.displayName = 'DialogHeader';

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex justify-end gap-2 p-6 pt-4', className)} {...props} />
);
DialogFooter.displayName = 'DialogFooter';

/* ── Preset: Informativo ─────────────────────────────────────────────────── */

export interface InfoDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  closeLabel?: string;
}

function InfoDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  closeLabel = 'Fechar',
}: InfoDialogProps) {
  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children && <div className="px-6 py-4">{children}</div>}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{closeLabel}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}

/* ── Preset: Confirmação ─────────────────────────────────────────────────── */

export interface ConfirmDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  cancelLabel?: string;
  confirmLabel?: string;
  onConfirm?: () => void | Promise<void>;
  isLoading?: boolean;
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  cancelLabel = 'Cancelar',
  confirmLabel = 'Confirmar',
  onConfirm,
  isLoading,
}: ConfirmDialogProps) {
  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children && <div className="px-6 py-4">{children}</div>}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{cancelLabel}</Button>
          </DialogClose>
          <Button onClick={onConfirm} isLoading={isLoading}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}

/* ── Preset: Destrutivo (exige digitação de "CONFIRMAR") ─────────────────── */

export interface DestructiveDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: string;
  confirmationWord?: string;
  cancelLabel?: string;
  confirmLabel?: string;
  onConfirm?: () => void | Promise<void>;
  isLoading?: boolean;
}

function DestructiveDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmationWord = 'CONFIRMAR',
  cancelLabel = 'Cancelar',
  confirmLabel = 'Sim, excluir',
  onConfirm,
  isLoading,
}: DestructiveDialogProps) {
  const [typed, setTyped] = React.useState('');
  const isConfirmed = typed === confirmationWord;

  React.useEffect(() => {
    if (!open) setTyped('');
  }, [open]);

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-danger-500">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="px-6 py-4">
          <p className="text-sm text-muted-foreground mb-3">
            Para confirmar, digite{' '}
            <code className="font-mono font-semibold text-foreground">{confirmationWord}</code>{' '}
            abaixo:
          </p>
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={confirmationWord}
            aria-label={`Digite ${confirmationWord} para confirmar`}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{cancelLabel}</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={!isConfirmed}
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}

export {
  DialogRoot,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  InfoDialog,
  ConfirmDialog,
  DestructiveDialog,
};
