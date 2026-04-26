'use client';

import * as React from 'react';
import { Btn, Mono, T } from '@dermaos/ui/ds';
import { MessageBubble, AITransitionSeparator } from './message-bubble';

export interface ThreadMessage {
  id:             string;
  conversationId: string;
  senderType:     'patient' | 'user' | 'ai_agent' | 'system';
  senderName:     string | null;
  contentType:    'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'template' | 'interactive';
  content:        string | null;
  mediaUrl:       string | null;
  status:         'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  createdAt:      Date;
  isInternalNote: boolean;
}

export interface ThreadProps {
  messages:        ThreadMessage[];
  onLoadOlder?:    () => void;
  hasMoreOlder?:   boolean;
  isLoadingOlder?: boolean;
  onRetry?:        (messageId: string) => void;
  typingUser?:     string | null;
}

export function Thread({
  messages,
  onLoadOlder,
  hasMoreOlder,
  isLoadingOlder,
  onRetry,
  typingUser,
}: ThreadProps) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const topSentinelRef = React.useRef<HTMLDivElement | null>(null);
  const [atBottom, setAtBottom] = React.useState(true);
  const prevLengthRef = React.useRef(messages.length);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const grew = messages.length > prevLengthRef.current;
    prevLengthRef.current = messages.length;
    if (grew && atBottom) el.scrollTop = el.scrollHeight;
  }, [messages.length, atBottom]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAtBottom(distance < 80);
  }

  React.useEffect(() => {
    if (!hasMoreOlder || !onLoadOlder) return;
    const el = topSentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isLoadingOlder) onLoadOlder();
      },
      { rootMargin: '100px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMoreOlder, onLoadOlder, isLoadingOlder]);

  function scrollToBottom() {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }

  const elements: React.ReactNode[] = [];
  let lastSender: ThreadMessage['senderType'] | null = null;
  for (const msg of messages) {
    if (lastSender === 'ai_agent' && msg.senderType === 'user') {
      elements.push(<AITransitionSeparator key={`sep-${msg.id}`} />);
    }
    elements.push(<MessageBubble key={msg.id} message={msg} onRetry={onRetry} />);
    lastSender = msg.senderType;
  }

  return (
    <div style={{ position: 'relative', display: 'flex', flex: 1, flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        aria-label="Histórico de mensagens"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px 18px',
          minHeight: 0,
        }}
      >
        {hasMoreOlder && (
          <div
            ref={topSentinelRef}
            style={{
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Mono size={9}>{isLoadingOlder ? 'CARREGANDO…' : ''}</Mono>
          </div>
        )}

        {messages.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Mono size={9}>NENHUMA MENSAGEM AINDA</Mono>
          </div>
        ) : (
          elements
        )}

        {typingUser && (
          <div
            style={{
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: T.textMuted,
              fontFamily: "'IBM Plex Sans', sans-serif",
            }}
          >
            <span style={{ display: 'inline-flex', gap: 2 }}>
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: T.textMuted,
                    animation: `ds-shimmer 1.2s ease-in-out ${delay}ms infinite`,
                  }}
                />
              ))}
            </span>
            {typingUser} está digitando…
          </div>
        )}
      </div>

      {!atBottom && (
        <div style={{ position: 'absolute', bottom: 16, right: 16 }}>
          <Btn
            variant="glass"
            small
            iconOnly
            icon="arrowRight"
            onClick={scrollToBottom}
            aria-label="Ir para a última mensagem"
            style={{ borderRadius: 999, transform: 'rotate(90deg)' }}
          />
        </div>
      )}
    </div>
  );
}
