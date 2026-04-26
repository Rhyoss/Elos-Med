'use client';

import * as React from 'react';
import { Mono, Skeleton, T } from '@dermaos/ui/ds';
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
  items:           ConversationListItem[];
  selectedId?:     string | null;
  onSelect:        (id: string) => void;
  onLoadMore?:     () => void;
  hasMore?:        boolean;
  isLoading?:      boolean;
  isFetchingMore?: boolean;
}

export function ConversationList({
  items,
  selectedId,
  onSelect,
  onLoadMore,
  hasMore,
  isLoading,
  isFetchingMore,
}: ConversationListProps) {
  const sentinelRef = React.useRef<HTMLLIElement | null>(null);

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
      <ul aria-busy="true" style={{ display: 'flex', flexDirection: 'column' }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <li
            key={i}
            style={{
              padding: '10px 12px',
              borderBottom: `1px solid ${T.divider}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <Skeleton height={12} width="70%" delay={i * 80} />
            <Skeleton height={10} width="90%" delay={i * 80 + 60} />
          </li>
        ))}
      </ul>
    );
  }

  if (items.length === 0) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
          textAlign: 'center',
        }}
      >
        <Mono size={9}>NENHUMA CONVERSA ENCONTRADA</Mono>
      </div>
    );
  }

  return (
    <ul role="listbox" aria-label="Lista de conversas" style={{ display: 'flex', flexDirection: 'column' }}>
      {items.map((conv) => {
        const isSelected = conv.id === selectedId;
        const hasUnread = conv.unreadCount > 0;
        const isUrgent = conv.priority === 'urgent' || conv.priority === 'high';
        return (
          <li key={conv.id}>
            <button
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => onSelect(conv.id)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderBottom: `1px solid ${T.divider}`,
                background: isSelected ? T.primaryBg : 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                border: 'none',
                borderLeft: isSelected ? `3px solid ${T.primary}` : '3px solid transparent',
                transition: 'background 0.15s',
                display: 'block',
                fontFamily: "'IBM Plex Sans', sans-serif",
              }}
            >
              {/* Header — name + time */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, gap: 6 }}>
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    fontWeight: hasUnread ? 700 : 500,
                    color: T.textPrimary,
                    minWidth: 0,
                  }}
                >
                  <ChannelIcon type={conv.channelType} className="h-3.5 w-3.5" />
                  <span
                    style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {conv.contactName}
                  </span>
                </span>
                <Mono size={8}>{formatRelativeTime(conv.lastMessageAt)}</Mono>
              </div>

              {/* Preview + unread dot */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                <span
                  style={{
                    fontSize: 10,
                    color: T.textMuted,
                    flex: 1,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {conv.lastMessagePreview ?? 'Sem mensagens'}
                </span>
                {hasUnread && (
                  <div
                    aria-label={`${conv.unreadCount} não lidas`}
                    style={{
                      width: 16,
                      height: 16,
                      minWidth: 16,
                      padding: '0 4px',
                      borderRadius: 999,
                      background: T.primary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ fontSize: 8, fontWeight: 700, color: '#fff' }}>
                      {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                    </span>
                  </div>
                )}
              </div>

              {/* Tags row */}
              <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span
                  style={{
                    padding: '0 5px',
                    borderRadius: 3,
                    background: conv.contactPatientId ? T.successBg : T.glass,
                    color: conv.contactPatientId ? T.success : T.textMuted,
                    fontSize: 8,
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontWeight: 600,
                    letterSpacing: '0.5px',
                  }}
                >
                  {conv.contactPatientId ? 'PACIENTE' : 'LEAD'}
                </span>
                {isUrgent && (
                  <span
                    style={{
                      padding: '0 5px',
                      borderRadius: 3,
                      background: T.dangerBg,
                      color: T.danger,
                      fontSize: 8,
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontWeight: 600,
                      letterSpacing: '0.5px',
                    }}
                  >
                    {conv.priority === 'urgent' ? 'URGENTE' : 'ALTA'}
                  </span>
                )}
                {conv.assignedToName && (
                  <span
                    style={{
                      fontSize: 9,
                      color: T.textMuted,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    · {conv.assignedToName}
                  </span>
                )}
              </div>
            </button>
          </li>
        );
      })}

      {hasMore && (
        <li ref={sentinelRef} style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isFetchingMore && <Mono size={9}>CARREGANDO…</Mono>}
        </li>
      )}
    </ul>
  );
}
