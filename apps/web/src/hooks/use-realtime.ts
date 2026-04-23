'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

/**
 * Conexão Socket.io singleton para a aba atual.
 * Autentica via cookie httpOnly (access_token) — mesmo cookie do tRPC.
 */

let socketSingleton: Socket | null = null;

function getSocket(): Socket {
  if (socketSingleton) return socketSingleton;
  socketSingleton = io({
    path: '/api/realtime',
    transports: ['websocket', 'polling'],
    withCredentials: true,
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5_000,
  });
  return socketSingleton;
}

type Handler = (payload: Record<string, unknown>) => void;

/**
 * Subscribe a um evento do servidor. Cleanup automático ao desmontar.
 * Passe um array de event names para escutar múltiplos com o mesmo handler.
 */
export function useRealtime(events: string | string[], handler: Handler): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const socket = getSocket();
    const list   = Array.isArray(events) ? events : [events];

    const wrapped: Handler = (payload) => handlerRef.current(payload);

    for (const evt of list) {
      socket.on(evt, wrapped);
    }
    return () => {
      for (const evt of list) {
        socket.off(evt, wrapped);
      }
    };
  }, [Array.isArray(events) ? events.join('|') : events]);
}

export function getRealtimeSocket(): Socket {
  return getSocket();
}
