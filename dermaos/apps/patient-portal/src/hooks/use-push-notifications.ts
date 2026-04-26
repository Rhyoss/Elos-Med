'use client';
import { useState, useEffect, useCallback } from 'react';
import { portalPush } from '@/lib/api-client';

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export function usePushNotifications() {
  const [permission, setPermission] = useState<PermissionState>('default');
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission as PermissionState);
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return false;

    // Não solicitar novamente se permissão foi negada
    if (Notification.permission === 'denied') {
      setPermission('denied');
      return false;
    }

    // Buscar chave VAPID pública
    const vapidRes = await portalPush.getVapidKey();
    if (!vapidRes.ok || !vapidRes.data?.publicKey) return false;

    const status = await Notification.requestPermission();
    setPermission(status as PermissionState);

    if (status !== 'granted') return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(vapidRes.data.publicKey),
      });

      const json = sub.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };

      const res = await portalPush.subscribe({ endpoint: json.endpoint, keys: json.keys });
      if (res.ok) {
        setSubscribed(true);
        return true;
      }
    } catch (err) {
      console.error('Push subscription failed:', err);
    }

    return false;
  }, []);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!('serviceWorker' in navigator)) return;

    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();

    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await portalPush.unsubscribe(endpoint);
      setSubscribed(false);
    }
  }, []);

  return { permission, subscribed, subscribe, unsubscribe };
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0))).buffer as ArrayBuffer;
}
