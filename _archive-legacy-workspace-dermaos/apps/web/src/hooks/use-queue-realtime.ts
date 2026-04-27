'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket, useSocketState } from './use-socket';
import { trpc } from '@/lib/trpc-provider';

export interface QueueEntry {
  position: number;
  appointment_id: string;
  patient_name: string;
  scheduled_time: string;
  checkin_time: string | null;
  wait_minutes: number | null;
  provider_name: string;
  status: string;
}

interface UseQueueRealTimeResult {
  queue: QueueEntry[];
  lastUpdated: Date | null;
  isLoading: boolean;
}

const POLLING_INTERVAL_MS = 30_000;

export function useQueueRealTime(): UseQueueRealTimeResult {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const socketState = useSocketState();
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch queue via API (used for initial load and as disconnect fallback)
  const utils = trpc.useUtils();
  const queueQuery = trpc.scheduling.waitQueue.useQuery(undefined, {
    enabled: false, // manual trigger only
    staleTime: 20_000,
  });

  const refreshFromApi = useCallback(async () => {
    try {
      const data = await utils.scheduling.queue.fetch();
      if (Array.isArray(data)) {
        setQueue(data as QueueEntry[]);
        setLastUpdated(new Date());
      }
    } catch {
      // Silently fail — real-time update will come when reconnected
    }
  }, [utils]);

  // Initial load
  useEffect(() => {
    void refreshFromApi();
  }, [refreshFromApi]);

  // Real-time updates from WebSocket (replace state completely — not merge)
  useSocket('queue:updated', (payload) => {
    const incoming = payload.queue;
    if (Array.isArray(incoming)) {
      setQueue(incoming as QueueEntry[]);
      setLastUpdated(new Date());
    }
  });

  // Polling fallback while disconnected
  useEffect(() => {
    if (socketState !== 'connected') {
      pollingRef.current = setInterval(() => {
        void refreshFromApi();
      }, POLLING_INTERVAL_MS);
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [socketState, refreshFromApi]);

  return {
    queue,
    lastUpdated,
    isLoading: queueQuery.isLoading && queue.length === 0,
  };
}
