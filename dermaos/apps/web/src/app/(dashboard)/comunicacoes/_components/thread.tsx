'use client';

import * as React from 'react';
import { ArrowDown } from 'lucide-react';
import { Button } from '@dermaos/ui';
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

  // Scroll para baixo quando chega mensagem nova (se já estava no final)
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const grew = messages.length > prevLengthRef.current;
    prevLengthRef.current = messages.length;
    if (grew && atBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, atBottom]);

  // Ajusta estado atBottom baseado no scroll
  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAtBottom(distance < 80);
  }

  // Infinite scroll ao topo para carregar mensagens anteriores
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

  // Insere separador AI→humano na transição
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
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3"
        aria-label="Histórico de mensagens"
      >
        {hasMoreOlder && (
          <div ref={topSentinelRef} className="flex h-8 items-center justify-center text-xs text-muted-foreground">
            {isLoadingOlder ? 'Carregando…' : ''}
          </div>
        )}
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Nenhuma mensagem ainda.
          </div>
        ) : (
          elements
        )}

        {typingUser && (
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex gap-0.5">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '0ms' }} />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '150ms' }} />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '300ms' }} />
            </span>
            {typingUser} está digitando…
          </div>
        )}
      </div>

      {!atBottom && (
        <Button
          size="sm"
          variant="outline"
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 rounded-full shadow-md"
          aria-label="Ir para a última mensagem"
        >
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
