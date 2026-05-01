'use client';

import * as React from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { cn } from '@dermaos/ui';
import { Mono, T } from '@dermaos/ui/ds';
import {
  type AgendaViewConfig,
  type Density,
  DENSITY,
  viewConfigFor,
  slotLabels,
  positionFor,
  heightFor,
  totalSlots,
} from '@/lib/agenda-utils';
import { AppointmentCard } from './appointment-card';
import type { AppointmentCardData } from './appointment-detail-sheet';

/* ── Current-time indicator ──────────────────────────────────────────────── */

function NowLine({ refDay, cfg }: { refDay: Date; cfg: AgendaViewConfig }) {
  const [now, setNow] = React.useState(new Date());
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const isSameDay =
    now.getFullYear() === refDay.getFullYear() &&
    now.getMonth() === refDay.getMonth() &&
    now.getDate() === refDay.getDate();
  if (!isSameDay) return null;
  const top = positionFor(now, refDay, cfg);
  if (top < 0 || top > totalSlots(cfg) * cfg.pxPerSlot) return null;
  return (
    <div
      className="absolute left-0 right-0 pointer-events-none z-10"
      style={{ top }}
    >
      <div className="flex items-center">
        <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
        <div className="flex-1 h-px bg-red-500/60" />
      </div>
    </div>
  );
}

/* ── Draggable card wrapper ──────────────────────────────────────────────── */

function DraggableCard({
  appointment,
  onClick,
  variant,
  style,
}: {
  appointment: AppointmentCardData;
  onClick?: (a: AppointmentCardData, ev?: React.MouseEvent) => void;
  variant: 'full' | 'compact';
  style?: React.CSSProperties;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: appointment.id,
    data: { appointment },
  });
  const dragStyle: React.CSSProperties = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : {};

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="absolute left-12 right-2"
      style={{
        ...style,
        ...dragStyle,
        zIndex: isDragging ? 50 : 1,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <AppointmentCard
        appointment={appointment}
        onClick={onClick}
        variant={variant}
        isDragging={isDragging}
      />
    </div>
  );
}

/* ── Droppable time slot ─────────────────────────────────────────────────── */

function DroppableSlot({
  id,
  height,
  isHour,
  onEmptyClick,
}: {
  id: string;
  height: number;
  isHour: boolean;
  onEmptyClick?: () => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'border-t transition-colors',
        isHour ? 'border-gray-200/80' : 'border-gray-100/50',
        isOver && 'bg-primary-50/40',
      )}
      style={{ height }}
      onClick={onEmptyClick}
    />
  );
}

/* ── Timeline ────────────────────────────────────────────────────────────── */

interface AgendaDayTimelineProps {
  appointments: AppointmentCardData[];
  date: Date;
  density: Density;
  onCardClick?: (a: AppointmentCardData, ev?: React.MouseEvent) => void;
  onEmptyClick?: (start: Date) => void;
}

export function AgendaDayTimeline({
  appointments,
  date,
  density,
  onCardClick,
  onEmptyClick,
}: AgendaDayTimelineProps) {
  const cfg = viewConfigFor(density);
  const labels = slotLabels(cfg);
  const total = totalSlots(cfg);
  const gridHeight = total * cfg.pxPerSlot;
  const d = DENSITY[density];

  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!scrollRef.current) return;
    const now = new Date();
    const top = positionFor(now, date, cfg);
    scrollRef.current.scrollTop = Math.max(0, top - 200);
  }, [date, cfg]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
      <div className="relative" style={{ height: gridHeight }}>
        {/* Hour labels + grid lines */}
        {labels.map((slot, i) => (
          <div
            key={slot.hhmm}
            className="absolute left-0 flex items-start"
            style={{ top: i * cfg.pxPerSlot, height: cfg.pxPerSlot, width: '100%' }}
          >
            {/* Time label (hour-only) */}
            <div className="w-12 shrink-0 text-right pr-2 -mt-1.5">
              {slot.isHour && (
                <Mono size={d.fontSize > 11 ? 10 : 9} color={T.textMuted}>{slot.hhmm}</Mono>
              )}
            </div>
            {/* Grid line + droppable */}
            <DroppableSlot
              id={`slot-${slot.hhmm}`}
              height={cfg.pxPerSlot}
              isHour={slot.isHour}
              onEmptyClick={() => {
                if (!onEmptyClick) return;
                const [hh, mm] = slot.hhmm.split(':').map(Number);
                const s = new Date(date);
                s.setHours(hh ?? 0, mm ?? 0, 0, 0);
                onEmptyClick(s);
              }}
            />
          </div>
        ))}

        {/* Now line */}
        <NowLine refDay={date} cfg={cfg} />

        {/* Appointment cards */}
        {appointments.map((ap) => {
          const apDate = new Date(ap.scheduledAt);
          const top = positionFor(apDate, date, cfg);
          const h = heightFor(ap.durationMin, cfg);
          const variant = h < 44 ? 'compact' : 'full';
          return (
            <DraggableCard
              key={ap.id}
              appointment={ap}
              onClick={onCardClick}
              variant={variant as 'full' | 'compact'}
              style={{ top, height: Math.max(h, 24) }}
            />
          );
        })}
      </div>

      {/* Empty state */}
      {appointments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: T.primaryBg }}
          >
            <Mono size={18} color={T.primary}>☀</Mono>
          </div>
          <p className="text-sm font-medium" style={{ color: T.textMuted }}>
            Nenhuma consulta neste dia
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                const s = new Date(date);
                s.setHours(9, 0, 0, 0);
                onEmptyClick?.(s);
              }}
              className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
              style={{ background: T.primaryBg, color: T.primary, border: `1px solid ${T.primaryBorder}` }}
            >
              Agendar consulta
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
