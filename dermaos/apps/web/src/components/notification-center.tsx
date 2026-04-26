'use client';

import * as React from 'react';
import { Bell, AlertTriangle, Syringe, Package, User, ShoppingCart, Info, Check, CheckCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNotifications, formatBadgeCount, type Notification, type CriticalAlert } from '@/hooks/use-notifications';

// ─── Icon map ─────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<string, React.ReactNode> = {
  biopsy_result: <Syringe className="h-4 w-4 text-purple-500" />,
  stock_critical: <Package className="h-4 w-4 text-red-500" />,
  lead_high_score: <User className="h-4 w-4 text-green-500" />,
  purchase_approval: <ShoppingCart className="h-4 w-4 text-blue-500" />,
  general: <Info className="h-4 w-4 text-gray-500" />,
};

const ENTITY_ROUTES: Record<string, (id: string) => string> = {
  encounter: (id) => `/pacientes/prontuario/${id}`,
  product: (id) => `/suprimentos/produto/${id}`,
  contact: (id) => `/pacientes/leads/${id}`,
  purchase_order: (id) => `/suprimentos/compras/${id}`,
};

function relativeTime(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ptBR });
  } catch {
    return '';
  }
}

// ─── Critical alert item ──────────────────────────────────────────────────────

function CriticalAlertItem({
  alert,
  onAck,
}: {
  alert: CriticalAlert;
  onAck: (id: string) => void;
}) {
  return (
    <div className="flex gap-3 rounded-md border border-destructive/50 bg-destructive/5 p-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-destructive">{alert.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{alert.message}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{relativeTime(alert.created_at)}</p>
        <button
          onClick={() => onAck(alert.alert_id)}
          className="mt-2 rounded bg-destructive px-2.5 py-1 text-xs font-medium text-white
                     hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-destructive"
        >
          Reconhecer
        </button>
      </div>
    </div>
  );
}

// ─── Notification item ────────────────────────────────────────────────────────

function NotificationItem({
  notification,
  onRead,
  onNavigate,
}: {
  notification: Notification;
  onRead: (id: string) => void;
  onNavigate: (url: string) => void;
}) {
  const icon = TYPE_ICONS[notification.type] ?? TYPE_ICONS.general;

  const handleClick = () => {
    if (!notification.is_read) onRead(notification.id);
    if (notification.entity_type && notification.entity_id) {
      const routeFn = ENTITY_ROUTES[notification.entity_type];
      if (routeFn) onNavigate(routeFn(notification.entity_id));
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`flex w-full gap-3 rounded-md p-3 text-left transition-colors hover:bg-muted
                  ${notification.is_read ? 'opacity-60' : ''}`}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={`truncate text-sm ${notification.is_read ? 'font-normal' : 'font-semibold'}`}>
            {notification.title}
          </p>
          {!notification.is_read && (
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
          )}
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{notification.message}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{relativeTime(notification.created_at)}</p>
      </div>
    </button>
  );
}

// ─── NotificationCenter ───────────────────────────────────────────────────────

export function NotificationCenter() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const {
    notifications,
    criticalAlerts,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    acknowledgeAlert,
  } = useNotifications();

  const panelRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        !panelRef.current?.contains(e.target as Node) &&
        !buttonRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const hasItems = criticalAlerts.length > 0 || notifications.length > 0;

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notificações${unreadCount > 0 ? ` (${formatBadgeCount(unreadCount)} não lidas)` : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative rounded-md p-1.5 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center
                       rounded-full bg-destructive px-0.5 text-[10px] font-bold text-white"
          >
            {formatBadgeCount(unreadCount)}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Central de notificações"
          className="absolute right-0 top-full z-50 mt-2 w-96 overflow-hidden rounded-xl border bg-background shadow-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Notificações</h2>
            {notifications.some((n) => !n.is_read) && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Marcar todas como lidas
              </button>
            )}
          </div>

          {/* Scrollable list */}
          <div className="max-h-[480px] overflow-y-auto p-2 space-y-1">
            {/* Critical alerts always at top */}
            {criticalAlerts.map((alert) => (
              <CriticalAlertItem
                key={alert.alert_id}
                alert={alert}
                onAck={(id) => {
                  acknowledgeAlert(id);
                }}
              />
            ))}

            {/* Notifications */}
            {notifications.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onRead={(id) => markAsRead([id])}
                onNavigate={(url) => {
                  setOpen(false);
                  router.push(url);
                }}
              />
            ))}

            {/* Loading */}
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <span className="text-xs text-muted-foreground">Carregando...</span>
              </div>
            )}

            {/* Empty state */}
            {!isLoading && !hasItems && (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
                <Bell className="h-8 w-8 opacity-20" />
                <p className="text-sm">Nenhuma notificação.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
