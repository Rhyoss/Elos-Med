'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@dermaos/ui';
import { ChannelIcon } from './channel-icon';
import { formatRelativeTime } from '../_lib/relative-time';

export interface ConversationListItem {
  id:                 string;
  contactName:        string;
  contactPatientId:   string | null;
  channelType:        'whatsapp' | 'instagram' | 'email' | 'sms' | 'webchat' | 'phone';
  channelName:        string;
  status:             'open' | 'pending' | 'resolved' | 'spam' | 'archived';
  priority:           'low' | 'normal' | 'high' | 'urgent';
  assignedToName:     string | null;
  unreadCount:        number;
  lastMessageAt:      Date | null;
  lastMessagePreview: string | null;
}

export interface ConversationListProps {
  items:          ConversationListItem[];
  selectedId?:    string | null;
  onSelect:       (id: string) => void;
  onLoadMore?:    () => void;
  hasMore?:       boolean;
  isLoading?:     boolean;
  isFetchingMore?: boolean;
}

/**
 * Lista virtualizada leve — usa IntersectionObserver no último item para
 * disparar paginação. Cada item é um <li> com altura fixa (72px),
 * suficiente para 1000+ conversas sem travar.
 */
export function ConversationList({
  items,
  selectedId,
  onSelect,
  onLoadMore,
  hasMore,
  isLoading,
  isFetchingMore,
}: ConversationListProps) {
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!hasMore || !onLoadMore) return;
    const el = sentinelRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingMore) onLoadMore();
      },
      { rootMargin: '200px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, onLoadMore, isFetchingMore]);

  if (isLoading && items.length === 0) {
    return (
      <ul className="flex flex-col" aria-busy="true">
        {Array.from({ length: 8 }).map((_, i) => (
          <li key={i} className="h-[72px] animate-pulse border-b border-border px-4 py-3">
            <div className="mb-2 h-4 w-32 rounded bg-muted" />
            <div className="h-3 w-48 rounded bg-muted" />
          </li>
        ))}
      </ul>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
        Nenhuma conversa encontrada.
      </div>
    );
  }

  return (
    <ul className="flex flex-col" role="listbox" aria-label="Lista de conversas">
      {items.map((conv) => {
        const isSelected = conv.id === selectedId;
        return (
          <li key={conv.id}>
            <button
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => onSelect(conv.id)}
              className={cn(
                'flex h-[72px] w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors',
                'hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                isSelected && 'bg-primary/10',
              )}
            >
              <div className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-muted text-muted-foreground">
                <ChannelIcon type={conv.channelType} className="h-4 w-4" />
              </div>

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
                    {conv.contactName}
                  </span>
                  <span className="flex-none text-xs text-muted-foreground">
                    {formatRelativeTime(conv.lastMessageAt)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs text-muted-foreground">
                    {conv.lastMessagePreview ?? 'Sem mensagens'}
                  </p>
                  {conv.unreadCount > 0 && (
                    <Badge variant="primary" size="sm" aria-label={`${conv.unreadCount} não lidas`}>
                      {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                    </Badge>
                  )}
                </div>

                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                  {conv.contactPatientId && (
                    <span className="rounded-sm bg-success-100 px-1 text-success-700">
                      paciente
                    </span>
                  )}
                  {!conv.contactPatientId && (
                    <span className="rounded-sm bg-muted px-1">lead</span>
                  )}
                  {conv.priority === 'high' || conv.priority === 'urgent' ? (
                    <span className="rounded-sm bg-danger-100 px-1 text-danger-700">
                      {conv.priority === 'urgent' ? 'urgente' : 'alta'}
                    </span>
                  ) : null}
                  {conv.assignedToName && (
                    <span className="truncate">· {conv.assignedToName}</span>
                  )}
                </div>
              </div>
            </button>
          </li>
        );
      })}

      {hasMore && (
        <li ref={sentinelRef} className="h-10 w-full">
          {isFetchingMore && (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              Carregando…
            </div>
          )}
        </li>
      )}
    </ul>
  );
}
