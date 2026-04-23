'use client';

import * as React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../utils.js';
import { Button } from '../primitives/button.js';

/* ── Tipos ──────────────────────────────────────────────────────────────── */

export interface TimelineEvent {
  id: string;
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  timestamp: string | Date;
  badge?: React.ReactNode;
  color?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'ai';
}

export interface TimelineActivityProps {
  events: TimelineEvent[];
  initialVisible?: number;
  showAllLabel?: string;
  showLessLabel?: string;
  className?: string;
}

/* ── Cores por tipo ──────────────────────────────────────────────────────── */

const colorClasses = {
  default: 'bg-muted text-muted-foreground border-border',
  success: 'bg-success-100 text-success-700 border-success-500/30',
  warning: 'bg-warning-100 text-warning-700 border-warning-500/30',
  danger:  'bg-danger-100 text-danger-700 border-danger-500/30',
  info:    'bg-info-100 text-info-700 border-info-500/30',
  ai:      'bg-ai-100 text-ai-700 border-ai/30',
};

function formatTimestamp(ts: string | Date): string {
  const date = ts instanceof Date ? ts : new Date(ts);
  if (Number.isNaN(date.getTime())) return String(ts);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/* ── Componente ──────────────────────────────────────────────────────────── */

export function TimelineActivity({
  events,
  initialVisible = 5,
  showAllLabel = 'Ver todos',
  showLessLabel = 'Ver menos',
  className,
}: TimelineActivityProps) {
  const [expanded, setExpanded] = React.useState(false);
  const hasMore = events.length > initialVisible;
  const visible = expanded ? events : events.slice(0, initialVisible);

  return (
    <div className={cn('flex flex-col', className)}>
      <ol className="relative flex flex-col">
        {visible.map((event, idx) => {
          const color = event.color ?? 'default';
          const isLast = idx === visible.length - 1;

          return (
            <li key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
              {/* Linha conectora */}
              {!isLast && (
                <span
                  className="absolute left-[18px] top-8 bottom-0 w-px bg-border"
                  aria-hidden="true"
                />
              )}

              {/* Ícone */}
              <span
                className={cn(
                  'relative z-raised flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs [&_svg]:size-4',
                  colorClasses[color],
                )}
                aria-hidden="true"
              >
                {event.icon ?? (
                  <span className="h-2 w-2 rounded-full bg-current" />
                )}
              </span>

              {/* Conteúdo */}
              <div className="flex flex-1 flex-col gap-0.5 pt-1.5 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="text-sm font-medium text-foreground">{event.title}</span>
                    {event.badge}
                  </div>
                  <time
                    dateTime={event.timestamp instanceof Date ? event.timestamp.toISOString() : event.timestamp}
                    className="text-xs text-muted-foreground shrink-0 whitespace-nowrap"
                  >
                    {formatTimestamp(event.timestamp)}
                  </time>
                </div>
                {event.subtitle && (
                  <p className="text-xs text-muted-foreground">{event.subtitle}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 self-start text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              {showLessLabel}
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              {showAllLabel} ({events.length})
            </>
          )}
        </Button>
      )}
    </div>
  );
}
