'use client';
import * as React from 'react';
import { T } from '../../tokens';
import { Ico, type IcoName } from './Ico';
import { Mono } from './Mono';

export interface TimelineEvent {
  id: string;
  date: string;
  label: string;
  detail?: string;
  icon?: IcoName;
  color?: string;
}

export interface TimelineProps {
  events: TimelineEvent[];
  emptyLabel?: string;
}

export function Timeline({ events, emptyLabel = 'Sem eventos registrados' }: TimelineProps) {
  if (events.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: T.textMuted, fontSize: 12 }}>
        {emptyLabel}
      </div>
    );
  }
  return (
    <div style={{ position: 'relative', paddingLeft: 24 }}>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 10,
          top: 0,
          bottom: 0,
          width: 1,
          background: T.divider,
        }}
      />
      {events.map((ev, i) => {
        const showDate = i === 0 || events[i - 1]?.date !== ev.date;
        const color = ev.color || T.primary;
        return (
          <div key={ev.id}>
            {showDate && (
              <div style={{ marginBottom: 8, marginLeft: -24 }}>
                <Mono size={9} spacing="1px" color={T.textMuted}>
                  {ev.date.toUpperCase()}
                </Mono>
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, marginBottom: 14, position: 'relative' }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: T.bg,
                  border: `1.5px solid ${color}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'absolute',
                  left: -24,
                  flexShrink: 0,
                  zIndex: 1,
                }}
              >
                <Ico name={ev.icon || 'grid'} size={10} color={color} />
              </div>
              <div style={{ marginLeft: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary, margin: 0 }}>
                  {ev.label}
                </p>
                {ev.detail && (
                  <p style={{ fontSize: 11, color: T.textMuted, margin: '2px 0 0' }}>
                    {ev.detail}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
