'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

/**
 * Singleton Socket.io connection for the entire web application.
 *
 * Auth: httpOnly cookie (access_token) sent via withCredentials.
 * The server reads the cookie in the handshake — no token exposure to JS.
 *
 * Reconnection: exponential backoff, initial 1s, max 30s, ±50% randomization.
 * Connection state propagates to all React consumers via subscriber callbacks.
 */

export type SocketState = 'connected' | 'reconnecting' | 'disconnected';

type StateListener = (state: SocketState) => void;

// ─── Module-level singleton ───────────────────────────────────────────────────

let _socket: Socket | null = null;
let _socketState: SocketState = 'disconnected';
const _stateListeners = new Set<StateListener>();

function notifyStateListeners(state: SocketState): void {
  if (_socketState === state) return;
  _socketState = state;
  for (const l of _stateListeners) l(state);
}

function createSocket(): Socket {
  // Conecta no mesmo origin do app (proxy via Next.js / Nginx em prod).
  // O cookie httpOnly de auth fica no origin do app, então mantemos same-origin.
  // O Next está com `skipTrailingSlashRedirect` para o engine.io poder usar
  // o path canônico `/api/realtime/`.
  const socket = io({
    path: '/api/realtime',
    transports: ['websocket', 'polling'],
    withCredentials: true,
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 30_000,
    randomizationFactor: 0.5,
  });

  socket.on('connect', () => notifyStateListeners('connected'));

  socket.on('disconnect', (reason) => {
    // 'io server disconnect' — server closed connection (auth failure, inactive user, etc.)
    // Socket.io will NOT automatically reconnect in this case.
    if (reason === 'io server disconnect') {
      notifyStateListeners('disconnected');
    } else {
      notifyStateListeners('reconnecting');
    }
  });

  socket.on('reconnect_attempt', () => notifyStateListeners('reconnecting'));
  socket.io.on('reconnect_failed', () => notifyStateListeners('disconnected'));
  socket.io.on('reconnect', () => notifyStateListeners('connected'));

  socket.on('auth_error', (err: { code: string; message: string }) => {
    notifyStateListeners('disconnected');
    socket.disconnect();
    console.error('[Socket] Auth error:', err.code, err.message);
  });

  return socket;
}

export function getSocket(): Socket {
  if (!_socket) _socket = createSocket();
  return _socket;
}

/** Call on user logout to clean up the singleton. */
export function destroySocket(): void {
  if (_socket) {
    _socket.disconnect();
    _socket.removeAllListeners();
    _socket = null;
  }
  notifyStateListeners('disconnected');
}

export function getSocketState(): SocketState {
  return _socketState;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Subscribe to one or more Socket.io server events.
 * Cleanup (socket.off) is automatic on unmount — no memory leaks.
 * Handler reference is stable via ref — no re-subscription on re-renders.
 */
export function useSocket(
  events: string | string[],
  handler: (payload: Record<string, unknown>) => void,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const eventsKey = Array.isArray(events) ? events.join('\x00') : events;

  useEffect(() => {
    const socket = getSocket();
    const eventList = Array.isArray(events) ? events : [events];
    // Stable wrapper identity — same reference used in both on() and off()
    const stable = (payload: Record<string, unknown>) => handlerRef.current(payload);

    for (const evt of eventList) socket.on(evt, stable);
    return () => {
      for (const evt of eventList) socket.off(evt, stable);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventsKey]);
}

/** Reactive connection status — re-renders the component when state changes. */
export function useSocketState(): SocketState {
  const [state, setState] = useState<SocketState>(() => _socketState);

  useEffect(() => {
    // Sync immediately in case state changed between render and effect
    setState(_socketState);
    _stateListeners.add(setState);
    return () => {
      _stateListeners.delete(setState);
    };
  }, []);

  return state;
}

/** Emit a client event to the server. */
export function useSocketEmit(): (event: string, data: unknown) => void {
  const emit = (event: string, data: unknown) => {
    getSocket().emit(event, data);
  };
  return emit;
}
