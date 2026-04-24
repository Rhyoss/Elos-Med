'use client';

import * as React from 'react';
import Image from 'next/image';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ImageOff, Loader2, RefreshCw } from 'lucide-react';
import { Button, LoadingSkeleton } from '@dermaos/ui';
import { cn } from '@/lib/utils';

export interface TimelineImage {
  id:               string;
  capturedAt:       Date | string;
  thumbnailUrl:     string | null;
  mediumUrl:        string | null;
  originalUrl:      string | null;
  altText:          string | null;
  processingStatus: 'pending' | 'processing' | 'ready' | 'processing_failed' | 'unprocessable';
  isCorrupted:      boolean;
}

interface LesionTimelineProps {
  images:      TimelineImage[];
  loading?:    boolean;
  selectedId?: string | null;
  onSelect?:   (img: TimelineImage) => void;
  onRetry?:    (img: TimelineImage) => void;
}

export function LesionTimeline({
  images,
  loading,
  selectedId,
  onSelect,
  onRetry,
}: LesionTimelineProps) {
  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto p-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <LoadingSkeleton key={i} className="h-32 w-32 rounded-lg shrink-0" />
        ))}
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Nenhuma imagem nesta lesão. Use o botão “Adicionar imagem” acima.
      </div>
    );
  }

  return (
    <div
      className="relative flex gap-3 overflow-x-auto pb-3 scroll-smooth"
      role="list"
      aria-label="Histórico de imagens da lesão"
    >
      {images.map((img) => {
        const date = typeof img.capturedAt === 'string' ? new Date(img.capturedAt) : img.capturedAt;
        const active  = selectedId === img.id;
        const pending = img.processingStatus === 'pending' || img.processingStatus === 'processing';
        const failed  = img.processingStatus === 'processing_failed' || img.processingStatus === 'unprocessable';

        return (
          <div
            key={img.id}
            role="listitem"
            className="flex flex-col items-center gap-1 shrink-0 w-32"
          >
            <button
              type="button"
              onClick={() => onSelect?.(img)}
              aria-label={img.altText ?? 'Imagem clínica'}
              aria-pressed={active}
              className={cn(
                'relative h-32 w-32 overflow-hidden rounded-lg border-2 bg-zinc-100 transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active ? 'border-primary-500' : 'border-transparent hover:border-border',
              )}
            >
              {img.thumbnailUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={img.thumbnailUrl}
                  alt={img.altText ?? ''}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : pending ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
                  <Loader2 size={20} className="animate-spin" />
                  Processando…
                </div>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
                  <ImageOff size={20} />
                  Indisponível
                </div>
              )}
            </button>
            <div className="text-xs text-foreground">
              {format(date, "dd MMM yyyy", { locale: ptBR })}
            </div>
            {failed && onRetry && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onRetry(img)}
                aria-label="Tentar processar novamente"
              >
                <RefreshCw size={12} /> Retry
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// placeholder de uso para evitar warnings de tree-shake
void Image;
