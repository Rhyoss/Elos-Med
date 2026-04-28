'use client';
import * as React from 'react';
import { T } from '../../tokens';
import { Btn } from './Btn';
import { Ico } from './Ico';
import { Mono } from './Mono';

// ─── ConversationList ──────────────────────────────────────────────

export interface ConversationItem {
  id: string;
  name: string;
  /** Channel short code (e.g. WA, IG, EM, SMS). */
  channel: string;
  preview: string;
  time: string;
  unread?: number;
  /** Optional avatar URL — fallback to first-letter initials. */
  photoUrl?: string;
}

export interface ConversationListProps {
  conversations: ReadonlyArray<ConversationItem>;
  selectedId?: string;
  onSelect: (item: ConversationItem) => void;
  /** Search box callback; omit to hide the search input. */
  onSearchChange?: (term: string) => void;
  searchValue?: string;
  emptyLabel?: string;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onSearchChange,
  searchValue = '',
  emptyLabel = 'Nenhuma conversa',
}: ConversationListProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
      }}
    >
      {onSearchChange && (
        <div style={{ padding: 10, borderBottom: `1px solid ${T.divider}`, flexShrink: 0 }}>
          <input
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar conversas…"
            style={{
              width: '100%',
              padding: '6px 10px',
              borderRadius: T.r.md,
              background: T.inputBg,
              border: `1px solid ${T.inputBorder}`,
              fontSize: 11,
              fontFamily: "'IBM Plex Sans', sans-serif",
              color: T.textPrimary,
              outline: 'none',
            }}
          />
        </div>
      )}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {conversations.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: T.textMuted, fontSize: 12 }}>
            {emptyLabel}
          </div>
        )}
        {conversations.map((c) => {
          const isSelected = selectedId === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderTop: 'none',
                borderRight: 'none',
                borderLeft: 'none',
                borderBottom: `1px solid ${T.divider}`,
                background: isSelected ? T.primaryBg : 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 2,
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: c.unread ? 700 : 500,
                    color: T.textPrimary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {c.name}
                </span>
                <Mono size={8}>{c.time}</Mono>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <div style={{ display: 'flex', gap: 5, alignItems: 'center', minWidth: 0, flex: 1 }}>
                  <span
                    style={{
                      fontSize: 8,
                      padding: '1px 5px',
                      borderRadius: 3,
                      background: T.primaryBg,
                      color: T.primary,
                      fontFamily: "'IBM Plex Mono', monospace",
                      flexShrink: 0,
                    }}
                  >
                    {c.channel}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: T.textMuted,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {c.preview}
                  </span>
                </div>
                {c.unread ? (
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 999,
                      background: T.primary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ fontSize: 8, fontWeight: 700, color: '#fff' }}>
                      {c.unread}
                    </span>
                  </div>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── ChatBubble ────────────────────────────────────────────────────

export interface ChatBubbleProps {
  /** Direction: 'in' = patient/incoming, 'out' = staff/outgoing. */
  direction: 'in' | 'out';
  text: string;
  time: string;
  /** Mark the bubble as AI-generated (Aurora). Adds zap icon + footer label. */
  ai?: boolean;
  /** Author name shown above the bubble (optional). */
  author?: string;
  /** Sent/delivered/read marker for outgoing messages. */
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
}

export function ChatBubble({ direction, text, time, ai, author, status }: ChatBubbleProps) {
  const isOut = direction === 'out';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isOut ? 'row-reverse' : 'row',
        gap: 7,
        alignItems: 'flex-end',
      }}
    >
      {isOut && ai && (
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: T.aiBg,
            border: `1px solid ${T.aiBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Ico name="zap" size={10} color={T.ai} />
        </div>
      )}
      <div
        style={{
          maxWidth: '72%',
          padding: '8px 12px',
          borderRadius: isOut
            ? `${T.r.lg}px ${T.r.sm}px ${T.r.lg}px ${T.r.lg}px`
            : `${T.r.sm}px ${T.r.lg}px ${T.r.lg}px ${T.r.lg}px`,
          background: isOut ? T.primaryBg : T.glass,
          border: `1px solid ${isOut ? T.primaryBorder : T.glassBorder}`,
        }}
      >
        {author && (
          <Mono size={7} spacing="0.6px" color={T.textMuted}>
            {author.toUpperCase()}
          </Mono>
        )}
        <p style={{ fontSize: 12, color: T.textPrimary, lineHeight: 1.55, margin: 0 }}>
          {text}
        </p>
        <div style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center' }}>
          <Mono size={7}>
            {time}
            {ai ? ' · Aurora IA' : ''}
            {status && status !== 'sending' ? ` · ${status}` : ''}
          </Mono>
          {status === 'sending' && (
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                border: `1.2px solid ${T.textMuted}`,
                borderTopColor: 'transparent',
                animation: 'ds-spin 0.7s linear infinite',
                display: 'inline-block',
              }}
            />
          )}
          {status === 'failed' && (
            <Ico name="alert" size={10} color={T.danger} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Composer ─────────────────────────────────────────────────────

export interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder?: string;
  disabled?: boolean;
  sending?: boolean;
  /** Toolbar slot rendered to the left of the input (templates, attach, etc). */
  leading?: React.ReactNode;
}

export function Composer({
  value,
  onChange,
  onSend,
  placeholder = 'Escreva uma mensagem…',
  disabled,
  sending,
  leading,
}: ComposerProps) {
  return (
    <div
      style={{
        padding: '10px 18px',
        borderTop: `1px solid ${T.divider}`,
        display: 'flex',
        gap: 8,
        flexShrink: 0,
        alignItems: 'center',
      }}
    >
      {leading}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && value.trim()) {
            e.preventDefault();
            onSend();
          }
        }}
        placeholder={placeholder}
        disabled={disabled || sending}
        style={{
          flex: 1,
          padding: '8px 12px',
          borderRadius: T.r.md,
          background: T.inputBg,
          border: `1px solid ${T.inputBorder}`,
          fontSize: 12,
          fontFamily: "'IBM Plex Sans', sans-serif",
          color: T.textPrimary,
          outline: 'none',
        }}
      />
      <Btn
        small
        icon="arrowRight"
        onClick={onSend}
        loading={sending}
        disabled={disabled || sending || !value.trim()}
      >
        Enviar
      </Btn>
    </div>
  );
}
