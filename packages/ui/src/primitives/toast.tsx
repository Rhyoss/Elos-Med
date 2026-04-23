'use client';

import * as React from 'react';
import { create } from 'zustand';
import { X, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';
import { cn } from '../utils.js';

/* ── Tipos ──────────────────────────────────────────────────────────────── */

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastStore {
  toasts: Toast[];
  add: (toast: Omit<Toast, 'id'>) => void;
  remove: (id: string) => void;
  clear: () => void;
}

/* ── Store Zustand ───────────────────────────────────────────────────────── */

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (toast) => {
    const id = Math.random().toString(36).slice(2);
    set((state) => ({
      // Máximo 3 toasts visíveis — remove o mais antigo se necessário
      toasts: [...state.toasts.slice(-2), { ...toast, id }],
    }));
  },
  remove: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

/* ── Hook público ────────────────────────────────────────────────────────── */

export function useToast() {
  const { add, remove, clear } = useToastStore();

  function toast(options: Omit<Toast, 'id'>) {
    add(options);
  }

  toast.success = (title: string, options?: Partial<Omit<Toast, 'id' | 'variant' | 'title'>>) =>
    add({ variant: 'success', title, ...options });
  toast.error = (title: string, options?: Partial<Omit<Toast, 'id' | 'variant' | 'title'>>) =>
    add({ variant: 'error', title, ...options });
  toast.warning = (title: string, options?: Partial<Omit<Toast, 'id' | 'variant' | 'title'>>) =>
    add({ variant: 'warning', title, ...options });
  toast.info = (title: string, options?: Partial<Omit<Toast, 'id' | 'variant' | 'title'>>) =>
    add({ variant: 'info', title, ...options });

  return { toast, remove, clear };
}

/* ── Configurações visuais por variante ──────────────────────────────────── */

const variantConfig = {
  success: {
    icon: CheckCircle,
    className: 'border-success-500/30 bg-card',
    iconClass: 'text-success-500',
    titleClass: 'text-success-700 dark:text-success-700',
  },
  error: {
    icon: XCircle,
    className: 'border-danger-500/30 bg-card',
    iconClass: 'text-danger-500',
    titleClass: 'text-danger-700 dark:text-danger-700',
  },
  warning: {
    icon: AlertTriangle,
    className: 'border-warning-500/30 bg-card',
    iconClass: 'text-warning-500',
    titleClass: 'text-warning-700 dark:text-warning-700',
  },
  info: {
    icon: Info,
    className: 'border-info-500/30 bg-card',
    iconClass: 'text-info-500',
    titleClass: 'text-info-700 dark:text-info-700',
  },
} as const;

/* ── ToastItem ───────────────────────────────────────────────────────────── */

interface ToastItemProps {
  toast: Toast;
}

function ToastItem({ toast }: ToastItemProps) {
  const { remove } = useToastStore();
  const config = variantConfig[toast.variant];
  const Icon = config.icon;
  const duration = toast.duration ?? 5000;

  React.useEffect(() => {
    const timer = setTimeout(() => remove(toast.id), duration);
    return () => clearTimeout(timer);
  }, [toast.id, duration, remove]);

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        `flex items-start gap-3 w-full min-w-[320px] max-w-[420px]
         rounded-lg border p-4 shadow-lg
         animate-toast-slide-in`,
        config.className,
      )}
    >
      <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', config.iconClass)} aria-hidden="true" />

      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium', config.titleClass)}>{toast.title}</p>
        {toast.description && (
          <p className="mt-1 text-xs text-muted-foreground">{toast.description}</p>
        )}
        {toast.action && (
          <button
            type="button"
            onClick={() => { toast.action!.onClick(); remove(toast.id); }}
            className="mt-2 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => remove(toast.id)}
        aria-label="Fechar notificação"
        className={cn(
          'shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        )}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/* ── Toaster: renderiza no canto superior direito ────────────────────────── */

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div
      aria-label="Notificações"
      className="fixed top-4 right-4 flex flex-col gap-2 pointer-events-none"
      style={{ zIndex: 'var(--z-toast)' }}
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} />
        </div>
      ))}
    </div>
  );
}
