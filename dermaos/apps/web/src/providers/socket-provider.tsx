'use client';

import * as React from 'react';
import { getSocket, destroySocket, useSocketState, type SocketState } from '@/hooks/use-socket';
import { useAuthStore } from '@/stores/auth-store';

interface SocketContextValue {
  state: SocketState;
  reconnect: () => void;
}

const SocketContext = React.createContext<SocketContextValue>({
  state: 'disconnected',
  reconnect: () => {},
});

export function useSocketContext(): SocketContextValue {
  return React.useContext(SocketContext);
}

/**
 * Manages the socket singleton lifecycle:
 *  - Connects when user is authenticated
 *  - Destroys connection on logout (clearSession)
 *  - Shows connection status to children via context
 */
export function SocketProvider({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const state = useSocketState();

  // Connect when authenticated, destroy on logout
  React.useEffect(() => {
    if (isAuthenticated) {
      getSocket(); // trigger singleton creation + auto-connect
    } else {
      destroySocket();
    }
  }, [isAuthenticated]);

  const reconnect = React.useCallback(() => {
    const socket = getSocket();
    if (!socket.connected) socket.connect();
  }, []);

  return (
    <SocketContext.Provider value={{ state, reconnect }}>
      {children}
      <ConnectionStatusBanner state={state} onReconnect={reconnect} />
    </SocketContext.Provider>
  );
}

// ─── Connection status banner ─────────────────────────────────────────────────

let reconnectingTimer: ReturnType<typeof setTimeout> | null = null;
const LONG_DISCONNECT_MS = 60_000;

function ConnectionStatusBanner({
  state,
  onReconnect,
}: {
  state: SocketState;
  onReconnect: () => void;
}) {
  const [showLongDisconnect, setShowLongDisconnect] = React.useState(false);

  React.useEffect(() => {
    if (state === 'reconnecting') {
      reconnectingTimer = setTimeout(() => setShowLongDisconnect(true), LONG_DISCONNECT_MS);
    } else {
      if (reconnectingTimer) {
        clearTimeout(reconnectingTimer);
        reconnectingTimer = null;
      }
      setShowLongDisconnect(false);
    }
    return () => {
      if (reconnectingTimer) clearTimeout(reconnectingTimer);
    };
  }, [state]);

  if (state === 'connected') return null;

  if (showLongDisconnect || state === 'disconnected') {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3
                   rounded-lg bg-destructive px-4 py-3 text-sm text-destructive-foreground shadow-lg"
      >
        <span>Sem conexão. Verifique sua internet.</span>
        <button
          onClick={onReconnect}
          className="rounded bg-white/20 px-2 py-0.5 text-xs font-medium hover:bg-white/30"
        >
          Reconectar
        </button>
      </div>
    );
  }

  // Reconnecting — subtle banner
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2
                 rounded-full bg-muted px-4 py-2 text-xs text-muted-foreground shadow"
    >
      <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
      Reconectando...
    </div>
  );
}
