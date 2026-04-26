'use client';

import * as React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { EmptyState, LoadingSkeleton } from '@dermaos/ui';
import type { TimelineImage } from './lesion-timeline';
import { cn } from '@/lib/utils';

interface GalleryProps {
  images:   TimelineImage[];
  loading?: boolean;
  onOpen?:  (img: TimelineImage) => void;
}

const COLUMN_MIN_WIDTH = 180;

/**
 * Grid virtualizado para lidar com 200+ imagens sem jank. Calcula o número de
 * colunas a partir do width do container e virtualiza as linhas.
 */
export function Gallery({ images, loading, onOpen }: GalleryProps) {
  const parentRef = React.useRef<HTMLDivElement>(null);
  const [columns, setColumns] = React.useState(4);

  React.useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const cols = Math.max(1, Math.floor(el.clientWidth / COLUMN_MIN_WIDTH));
      setColumns(cols);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rowCount = Math.ceil(images.length / columns);
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => COLUMN_MIN_WIDTH + 28,
    overscan: 4,
  });

  if (loading) {
    return (
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns * 2 }).map((_, i) => (
          <LoadingSkeleton key={i} className="aspect-square rounded-lg" />
        ))}
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <EmptyState
        title="Nenhuma imagem registrada para este paciente."
        description="Use o botão “Adicionar imagem” para registrar a primeira foto clínica."
      />
    );
  }

  return (
    <div ref={parentRef} className="h-[60vh] overflow-auto">
      <div
        style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}
      >
        {virtualizer.getVirtualItems().map((row) => {
          const start = row.index * columns;
          const rowImages = images.slice(start, start + columns);
          return (
            <div
              key={row.key}
              className="grid gap-3 px-1 absolute left-0 right-0"
              style={{
                transform: `translateY(${row.start}px)`,
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              }}
              data-index={row.index}
            >
              {rowImages.map((img) => (
                <GalleryTile key={img.id} image={img} onOpen={onOpen} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GalleryTile({
  image, onOpen,
}: { image: TimelineImage; onOpen?: (img: TimelineImage) => void }) {
  const failed = image.processingStatus === 'processing_failed' || image.processingStatus === 'unprocessable';
  const ready  = image.processingStatus === 'ready' && !!image.thumbnailUrl;
  const date   = typeof image.capturedAt === 'string' ? new Date(image.capturedAt) : image.capturedAt;

  return (
    <button
      type="button"
      onClick={() => onOpen?.(image)}
      aria-label={image.altText ?? 'Imagem clínica'}
      className={cn(
        'group flex flex-col gap-1 rounded-lg overflow-hidden bg-zinc-100 border border-border',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <div className="aspect-square w-full overflow-hidden relative">
        {ready ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={image.thumbnailUrl!}
            alt={image.altText ?? ''}
            loading="lazy"
            className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform"
          />
        ) : failed ? (
          <div className="flex h-full w-full flex-col items-center justify-center text-xs text-muted-foreground">
            Imagem indisponível — tente novamente
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            Processando…
          </div>
        )}
      </div>
      <div className="px-2 pb-2 text-[11px] text-muted-foreground text-left">
        {format(date, "dd MMM yyyy", { locale: ptBR })}
      </div>
    </button>
  );
}
