'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useSocket } from './use-socket';
import { trpc } from '@/lib/trpc-provider';

/**
 * Keeps the inbox conversation list in sync with real-time events.
 *
 * On new_message: moves conversation to top + increments unread count.
 * On conversation_updated: updates status/assignment.
 * Sound: plays notification sound if conversation is NOT currently open,
 *        user has sound enabled, and browser has audio permission.
 */

interface NewMessagePayload {
  conversation_id: string;
  message_id: string;
  channel: string;
  sender_name: string;
  preview: string;
  timestamp: string;
  unread_count: number;
}

interface ConversationUpdatedPayload {
  conversation_id: string;
  status: string;
  assigned_to: string | null;
  updated_at: string;
}

interface UseInboxRealTimeOptions {
  /** ID of the conversation currently open in the UI (if any). */
  activeConversationId?: string | null;
  /** Callback fired when inbox should be refreshed (e.g. invalidate query). */
  onInvalidate?: () => void;
  /** Callback fired when a new message arrives (for UI list update). */
  onNewMessage?: (payload: NewMessagePayload) => void;
  /** Callback fired when a conversation status changes. */
  onConversationUpdated?: (payload: ConversationUpdatedPayload) => void;
  /** Whether user has sound enabled (from notification prefs). */
  soundEnabled?: boolean;
}

let audioCtx: AudioContext | null = null;

function tryPlayNotificationSound(): void {
  try {
    if (!audioCtx) {
      audioCtx = new AudioContext();
    }
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.3);
  } catch {
    // AudioContext may be blocked by browser — ignore silently
  }
}

export function useInboxRealTime(opts: UseInboxRealTimeOptions = {}): void {
  const { activeConversationId, onInvalidate, onNewMessage, onConversationUpdated, soundEnabled = true } = opts;
  const activeIdRef = useRef(activeConversationId);
  activeIdRef.current = activeConversationId ?? null;

  const utils = trpc.useUtils();

  const invalidate = useCallback(() => {
    void utils.omni.unreadCount.invalidate();
    onInvalidate?.();
  }, [utils, onInvalidate]);

  useSocket('inbox:new_message', (raw) => {
    const payload = raw as unknown as NewMessagePayload;
    if (!payload.conversation_id) return;

    onNewMessage?.(payload);
    invalidate();

    // Sound: only if conversation is NOT the one currently open
    if (
      soundEnabled &&
      payload.conversation_id !== activeIdRef.current
    ) {
      tryPlayNotificationSound();
    }
  });

  useSocket('inbox:conversation_updated', (raw) => {
    const payload = raw as unknown as ConversationUpdatedPayload;
    if (!payload.conversation_id) return;

    onConversationUpdated?.(payload);
    invalidate();
  });

  useSocket('inbox:typing', (raw) => {
    // Typing indicator: consumers can subscribe to 'inbox:typing' separately if needed.
    // This hook doesn't manage typing state — keep it focused on conversation list sync.
    void raw;
  });
}

export type { NewMessagePayload, ConversationUpdatedPayload };
