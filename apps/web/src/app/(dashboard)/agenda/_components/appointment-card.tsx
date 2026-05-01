'use client';

import * as React from 'react';
import { cn } from '@dermaos/ui';
import { Badge, Ico, Mono, T } from '@dermaos/ui/ds';
import {
  STATUS_LABEL,
  STATUS_DOT_COLOR,
  formatTime,
  moduleKeyFor,
  isDelayed,
  delayMinutes,
} from '@/lib/agenda-utils';
import type { AppointmentCardData } from './appointment-detail-sheet';

/* ── Status badge variant ────────────────────────────────────────────────── */

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  scheduled:   'default',
  confirmed:   'success',
  waiting:     'warning',
  checked_in:  'success',
  in_progress: 'info',
  completed:   'default',
  cancelled:   'danger',
  no_show:     'warning',
  rescheduled: 'info',
};

/* ── Props ───────────────────────────────────────────────────────────────── */

interface AppointmentCardProps {
  appointment: AppointmentCardData;
  onClick?: (a: AppointmentCardData, ev?: React.MouseEvent) => void;
  variant?: 'full' | 'compact' | 'mini';
  isDragging?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export const AppointmentCard = React.memo(function AppointmentCard({
  appointment: ap,
  onClick,
  variant = 'full',
  isDragging = false,
  className,
  style,
}: AppointmentCardProps) {
  const mod = T[moduleKeyFor(ap.type ?? ap.service?.name ?? '')];
  const badgeVariant = STATUS_VARIANT[ap.status] ?? 'default';
  const statusLabel = STATUS_LABEL[ap.status] ?? ap.status;
  const delayed = isDelayed(ap.scheduledAt, ap.status);
  const delayMins = delayed ? delayMinutes(ap.scheduledAt) : 0;
  const hasAllergy = ap.patient.allergiesCount > 0;

  if (variant === 'mini') {
    return (
      <button
        type="button"
        onClick={(e) => onClick?.(ap, e)}
        className={cn(
          'w-full text-left rounded-md px-1.5 py-0.5 border-l-[3px] transition-shadow cursor-pointer',
          isDragging && 'shadow-lg ring-2 ring-primary-200 opacity-90',
          className,
        )}
        style={{
          borderLeftColor: mod.color,
          background: mod.bg,
          ...style,
        }}
      >
        <p className="text-[10px] font-semibold truncate" style={{ color: T.textPrimary }}>
          {ap.patient?.name ?? '—'}
        </p>
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={(e) => onClick?.(ap, e)}
        className={cn(
          'w-full text-left rounded-md border-l-[3px] transition-all cursor-pointer',
          isDragging && 'shadow-lg ring-2 ring-primary-200 opacity-90',
          className,
        )}
        style={{
          borderLeftColor: mod.color,
          background: mod.bg,
          borderTop: `1px solid ${mod.color}18`,
          borderRight: `1px solid ${mod.color}18`,
          borderBottom: `1px solid ${mod.color}18`,
          padding: '4px 6px',
          ...style,
        }}
      >
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold truncate" style={{ color: T.textPrimary }}>
              {ap.patient?.name ?? '—'}
            </p>
            <p className="text-[9px] truncate" style={{ color: T.textTertiary }}>
              {formatTime(ap.scheduledAt)} · {ap.service?.name ?? ap.type}
            </p>
          </div>
          {delayed && (
            <span className="shrink-0 text-[8px] font-bold text-red-500">
              +{delayMins}min
            </span>
          )}
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => onClick?.(ap, e)}
      className={cn(
        'w-full text-left rounded-lg border-l-[3px] transition-all cursor-pointer group',
        isDragging && 'shadow-xl ring-2 ring-primary-200 opacity-90 scale-[1.02]',
        className,
      )}
      style={{
        borderLeftColor: mod.color,
        background: mod.bg,
        borderTop: `1px solid ${mod.color}18`,
        borderRight: `1px solid ${mod.color}18`,
        borderBottom: `1px solid ${mod.color}18`,
        padding: '8px 10px',
        ...style,
      }}
    >
      {/* Row 1: Patient + Badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold overflow-hidden"
            style={{
              background: ap.patient.photoUrl ? undefined : mod.bg,
              border: `1px solid ${mod.color}30`,
              color: mod.color,
            }}
          >
            {ap.patient.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ap.patient.photoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              initials(ap.patient.name)
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold truncate" style={{ color: T.textPrimary }}>
              {ap.patient?.name ?? '—'}
            </p>
            <p className="text-[10px] truncate" style={{ color: T.textTertiary }}>
              {ap.service?.name ?? ap.type}
            </p>
          </div>
        </div>
        <Badge variant={badgeVariant} dot={false} >
          {statusLabel}
        </Badge>
      </div>

      {/* Row 2: Time + Provider + Room */}
      <div className="flex items-center justify-between mt-1.5">
        <div className="flex items-center gap-2">
          <Mono size={9}>{formatTime(ap.scheduledAt)}–{
            formatTime(new Date(new Date(ap.scheduledAt).getTime() + ap.durationMin * 60_000))
          }</Mono>
          {ap.room && (
            <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: `${mod.color}10`, color: mod.color }}>
              {ap.room}
            </span>
          )}
        </div>
        <Mono size={8} color={mod.color}>
          {ap.provider?.name ? ap.provider.name.split(' ')[0]?.toUpperCase() : ''}
        </Mono>
      </div>

      {/* Row 3: Alerts */}
      {(hasAllergy || delayed) && (
        <div className="flex items-center gap-1.5 mt-1.5">
          {hasAllergy && (
            <span className="flex items-center gap-0.5 text-[9px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
              <Ico name="alert" size={9} color="#dc2626" />
              Alergia
            </span>
          )}
          {delayed && (
            <span className="flex items-center gap-0.5 text-[9px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
              <Ico name="clock" size={9} color="#b45309" />
              +{delayMins}min atraso
            </span>
          )}
        </div>
      )}
    </button>
  );
});
