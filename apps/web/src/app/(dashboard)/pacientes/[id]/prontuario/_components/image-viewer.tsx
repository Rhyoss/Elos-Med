'use client';

import * as React from 'react';
import { Btn, Ico, Mono, T } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';

export interface ImageMeta {
  id:          string;
  thumbnailUrl: string | null;
  mediumUrl:    string | null;
  originalUrl:  string | null;
  capturedAt:   Date | string;
  captureType:  string | null;
  notes:        string | null;
  altText:      string | null;
}

interface ImageViewerProps {
  open:    boolean;
  onClose: () => void;
  /** Imagem inicial a exibir. */
  current: ImageMeta | null;
  /** Pool completo de imagens do paciente — usado para "comparar com" e navegação. */
  pool:    ImageMeta[];
}

const CAPTURE_LABEL: Record<string, string> = {
  clinical:    'Clínica',
  dermoscopy:  'Dermoscopia',
  trichoscopy: 'Tricoscopia',
  pre:         'Pré-procedimento',
  post:        'Pós-procedimento',
  'follow-up': 'Acompanhamento',
};

function formatDate(d: Date | string | null): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Visualizador modal de imagem clínica.
 *
 * Modos:
 *   - "single": imagem central com zoom (1x → 3x via slider).
 *   - "compare": duas imagens lado-a-lado para acompanhar evolução.
 *
 * Se a imagem não tiver presigned URL (`mediumUrl` / `originalUrl`), tenta
 * buscar via `clinical.lesions.requestImageUrl` mutation para gerar uma.
 */
export function ImageViewer({ open, onClose, current, pool }: ImageViewerProps) {
  const [zoom,        setZoom]        = React.useState(1);
  const [compareMode, setCompareMode] = React.useState(false);
  const [compareWith, setCompareWith] = React.useState<ImageMeta | null>(null);

  React.useEffect(() => {
    if (!open) {
      setZoom(1);
      setCompareMode(false);
      setCompareWith(null);
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !current) return null;

  const fallbackPool = pool.filter((p) => p.id !== current.id);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Visualizador de imagem clínica"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20, 20, 22, 0.78)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: T.r.lg,
          maxWidth: compareMode ? '95vw' : '85vw',
          maxHeight: '92vh',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: T.shadow.xl,
        }}
      >
        {/* Header */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            borderBottom: `1px solid ${T.divider}`,
          }}
        >
          <div>
            <Mono size={9} spacing="1px" color={T.primary}>
              {current.captureType ? CAPTURE_LABEL[current.captureType] ?? current.captureType : 'Imagem'}
              {' · '}
              {formatDate(current.capturedAt)}
            </Mono>
            {current.notes && (
              <p style={{ fontSize: 13, color: T.textPrimary, marginTop: 4 }}>{current.notes}</p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Btn
              variant={compareMode ? 'glass' : 'ghost'}
              small
              icon="layers"
              onClick={() => {
                setCompareMode(!compareMode);
                if (!compareMode && fallbackPool[0]) setCompareWith(fallbackPool[0]);
              }}
              disabled={fallbackPool.length === 0}
            >
              {compareMode ? 'Sair de comparar' : 'Comparar'}
            </Btn>
            <Btn variant="ghost" small icon="x" onClick={onClose}>Fechar</Btn>
          </div>
        </header>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            background: '#0a0a0c',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
        >
          {compareMode ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, width: '100%' }}>
              <ZoomedImage img={current} zoom={zoom} label="Atual" />
              {compareWith && <ZoomedImage img={compareWith} zoom={zoom} label="Comparando" />}
            </div>
          ) : (
            <ZoomedImage img={current} zoom={zoom} />
          )}
        </div>

        {/* Compare picker */}
        {compareMode && fallbackPool.length > 0 && (
          <div
            style={{
              padding: '8px 12px',
              borderTop: `1px solid ${T.divider}`,
              display: 'flex',
              gap: 6,
              overflowX: 'auto',
              background: T.glass,
            }}
          >
            <Mono size={8} color={T.textMuted}>
              COMPARAR COM:
            </Mono>
            {fallbackPool.map((p) => {
              const selected = compareWith?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setCompareWith(p)}
                  title={`${p.captureType ?? 'Imagem'} · ${formatDate(p.capturedAt)}`}
                  style={{
                    width: 56,
                    height: 56,
                    border: selected ? `2px solid ${T.primary}` : `1px solid ${T.glassBorder}`,
                    borderRadius: T.r.sm,
                    overflow: 'hidden',
                    flexShrink: 0,
                    cursor: 'pointer',
                    background: p.thumbnailUrl ? `center/cover url(${p.thumbnailUrl})` : T.glass,
                    padding: 0,
                  }}
                >
                  {!p.thumbnailUrl && <Ico name="image" size={22} color={T.textMuted} />}
                </button>
              );
            })}
          </div>
        )}

        {/* Zoom slider */}
        <footer
          style={{
            padding: '10px 18px',
            borderTop: `1px solid ${T.divider}`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Mono size={8} color={T.textMuted}>
            ZOOM
          </Mono>
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Zoom da imagem"
            style={{ flex: 1, accentColor: T.primary }}
          />
          <Mono size={9}>{zoom.toFixed(1)}×</Mono>
          <Btn variant="ghost" small onClick={() => setZoom(1)}>
            Reset
          </Btn>
        </footer>
      </div>
    </div>
  );
}

function ZoomedImage({
  img,
  zoom,
  label,
}: {
  img: ImageMeta;
  zoom: number;
  label?: string;
}) {
  const url = img.mediumUrl ?? img.originalUrl ?? img.thumbnailUrl;

  // Se nenhum presigned URL ainda, tenta buscar via mutation
  const requestUrlMut = trpc.clinical.lesions.requestImageUrl.useMutation();
  const [resolvedUrl, setResolvedUrl] = React.useState<string | null>(url);

  React.useEffect(() => {
    setResolvedUrl(url);
    if (!url) {
      requestUrlMut
        .mutateAsync({ imageId: img.id, variant: 'medium' })
        .then((res) => setResolvedUrl(res.url))
        .catch(() => setResolvedUrl(null));
    }
    // requestUrlMut intentionally excluded from deps to avoid loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img.id, url]);

  return (
    <figure style={{ position: 'relative', maxWidth: '100%', textAlign: 'center' }}>
      {resolvedUrl ? (
        <img
          src={resolvedUrl}
          alt={img.altText ?? 'Imagem clínica'}
          style={{
            maxWidth: '100%',
            maxHeight: '70vh',
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
            transition: 'transform 0.15s ease',
            borderRadius: T.r.sm,
          }}
        />
      ) : (
        <div
          style={{
            width: 320,
            height: 240,
            background: T.glass,
            borderRadius: T.r.sm,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: T.textMuted,
            fontSize: 12,
          }}
        >
          Imagem indisponível
        </div>
      )}
      {label && (
        <figcaption
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            background: 'rgba(0,0,0,0.65)',
            color: '#fff',
            padding: '3px 8px',
            borderRadius: T.r.sm,
            fontSize: 10,
            fontFamily: "'IBM Plex Mono', monospace",
            letterSpacing: '0.05em',
          }}
        >
          {label}
        </figcaption>
      )}
    </figure>
  );
}
