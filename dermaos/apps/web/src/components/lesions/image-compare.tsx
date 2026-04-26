'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { TimelineImage } from './lesion-timeline';
import { cn } from '@/lib/utils';

interface ImageCompareProps {
  left:   TimelineImage | null;
  right:  TimelineImage | null;
  images: TimelineImage[];
  onChangeLeft:  (img: TimelineImage) => void;
  onChangeRight: (img: TimelineImage) => void;
}

/**
 * Comparação side-by-side com slider arrastável. Usa CSS clip-path para
 * evitar re-render — apenas a CSS var --pos muda via state.
 */
export function ImageCompare({
  left,
  right,
  images,
  onChangeLeft,
  onChangeRight,
}: ImageCompareProps) {
  const [pos, setPos]  = React.useState(50);
  const containerRef   = React.useRef<HTMLDivElement>(null);
  const dragging       = React.useRef(false);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    updatePos(e.clientX);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    updatePos(e.clientX);
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    dragging.current = false;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  }
  function updatePos(clientX: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.min(100, Math.max(0, next)));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <DateSelect
          label="Antes"
          value={left?.id ?? ''}
          images={images}
          onChange={(img) => onChangeLeft(img)}
        />
        <DateSelect
          label="Depois"
          value={right?.id ?? ''}
          images={images}
          onChange={(img) => onChangeRight(img)}
        />
      </div>

      <div
        ref={containerRef}
        className="relative aspect-square w-full overflow-hidden rounded-lg bg-zinc-100 select-none"
        role="group"
        aria-label="Comparação temporal de imagens"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ '--pos': `${pos}%` } as React.CSSProperties}
      >
        {/* Imagem "depois" ocupa fundo */}
        {right?.mediumUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={right.mediumUrl}
            alt={right.altText ?? 'Imagem após'}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-contain"
            draggable={false}
          />
        ) : (
          <EmptySlot label="Depois" />
        )}

        {/* "antes" clipado pela posição */}
        {left?.mediumUrl && (
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ clipPath: 'inset(0 calc(100% - var(--pos)) 0 0)' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={left.mediumUrl}
              alt={left.altText ?? 'Imagem anterior'}
              loading="lazy"
              className="h-full w-full object-contain"
              draggable={false}
            />
          </div>
        )}

        {/* Linha e handle */}
        <div
          className={cn(
            'absolute top-0 bottom-0 w-[2px] bg-primary-500',
            'pointer-events-none',
          )}
          style={{ left: 'var(--pos)' }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-8 w-8 rounded-full bg-primary-500 border-2 border-white shadow-md cursor-ew-resize"
          style={{ left: 'var(--pos)' }}
          aria-hidden="true"
        />

        <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/50 text-white text-xs rounded">
          {left ? format(toDate(left.capturedAt), 'dd MMM yyyy', { locale: ptBR }) : '—'}
        </div>
        <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/50 text-white text-xs rounded">
          {right ? format(toDate(right.capturedAt), 'dd MMM yyyy', { locale: ptBR }) : '—'}
        </div>
      </div>
    </div>
  );
}

function toDate(v: Date | string): Date {
  return typeof v === 'string' ? new Date(v) : v;
}

function DateSelect({
  label, value, images, onChange,
}: {
  label:    string;
  value:    string;
  images:   TimelineImage[];
  onChange: (img: TimelineImage) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}:</span>
      <select
        className="rounded-md border border-border bg-card px-2 py-1 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={value}
        onChange={(e) => {
          const img = images.find((i) => i.id === e.target.value);
          if (img) onChange(img);
        }}
      >
        <option value="" disabled>Escolha</option>
        {images.map((img) => (
          <option key={img.id} value={img.id}>
            {format(toDate(img.capturedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </option>
        ))}
      </select>
    </label>
  );
}

function EmptySlot({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
      Selecione imagem — {label}
    </div>
  );
}
