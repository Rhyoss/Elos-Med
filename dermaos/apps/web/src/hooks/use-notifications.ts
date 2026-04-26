'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSocket, getSocket } from './use-socket';
import { trpc } from '@/lib/trpc-provider';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  priority: string;
  is_read: boolean;
  read_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

export interface CriticalAlert {
  alert_id: string;
  type: string;
  title: string;
  message: string;
  severity: string;
  requires_ack: boolean;
  created_at: string;
}

interface UseNotificationsResult {
  notifications: Notification[];
  criticalAlerts: CriticalAlert[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (ids: string[]) => void;
  markAllAsRead: () => void;
  acknowledgeAlert: (alertId: string) => void;
}

const BADGE_MAX = 99;

export function useNotifications(): UseNotificationsResult {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [criticalAlerts, setCriticalAlerts] = useState<CriticalAlert[]>([]);

  const utils = trpc.useUtils();

  // ── Server query: initial unread list ──────────────────────────────────────
  const listQuery = trpc.notifications.list.useQuery(
    { limit: 50, offset: 0 },
    { staleTime: 30_000 },
  );
  const unreadCountQuery = trpc.notifications.unreadCount.useQuery(undefined, {
    staleTime: 10_000,
  });

  useEffect(() => {
    if (listQuery.data?.notifications) {
      setNotifications(listQuery.data.notifications as unknown as Notification[]);
    }
  }, [listQuery.data]);

  // ── Real-time: new notification from server ────────────────────────────────
  useSocket('notification', (raw) => {
    const n = raw as unknown as Notification;
    if (!n.id) return;

    // Prepend to local list (avoid duplicate)
    setNotifications((prev) => {
      if (prev.some((x) => x.id === n.id)) return prev;
      return [n, ...prev];
    });

    // Acknowledge receipt to server (triggers delivered_at update in DB)
    getSocket().emit('notification:ack', { notification_id: n.id });

    // Refresh server unread count
    void utils.notifications.unreadCount.invalidate();
  });

  // ── Real-time: critical alerts ─────────────────────────────────────────────
  useSocket('alert:critical', (raw) => {
    const alert = raw as unknown as CriticalAlert;
    if (!alert.alert_id) return;

    setCriticalAlerts((prev) => {
      if (prev.some((x) => x.alert_id === alert.alert_id)) {
        // Re-emit from server — update in place
        return prev.map((x) => (x.alert_id === alert.alert_id ? alert : x));
      }
      return [alert, ...prev];
    });
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const markAsReadMutation = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => {
      void utils.notifications.unreadCount.invalidate();
      void listQuery.refetch();
    },
  });

  const markAllAsReadMutation = trpc.notifications.markAllAsRead.useMutation({
    onSuccess: () => {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      void utils.notifications.unreadCount.invalidate();
    },
  });

  const markAsRead = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      setNotifications((prev) =>
        prev.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n)),
      );
      markAsReadMutation.mutate({ ids });
    },
    [markAsReadMutation],
  );

  const markAllAsRead = useCallback(() => {
    markAllAsReadMutation.mutate();
  }, [markAllAsReadMutation]);

  const acknowledgeAlert = useCallback((alertId: string) => {
    getSocket().emit('alert:ack', { alert_id: alertId });
    setCriticalAlerts((prev) => prev.filter((a) => a.alert_id !== alertId));
  }, []);

  // ── Computed ───────────────────────────────────────────────────────────────
  const serverCount = unreadCountQuery.data?.count ?? 0;
  const localUnread = notifications.filter((n) => !n.is_read).length;
  const unreadCount = Math.min(Math.max(serverCount, localUnread), BADGE_MAX);

  return {
    notifications,
    criticalAlerts,
    unreadCount,
    isLoading: listQuery.isLoading,
    markAsRead,
    markAllAsRead,
    acknowledgeAlert,
  };
}

export function formatBadgeCount(count: number): string {
  return count > 99 ? '99+' : String(count);
}
