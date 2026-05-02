'use client';

import * as React from 'react';
import { Btn, Glass, Ico, Mono, Badge, T } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { regionLabel } from '@/components/lesions/body-regions';
import type { ImageMeta } from './image-viewer';

interface PhotoCompareDialogProps {
  open:    boolean;
  onClose: () => void;
  /** Pool de imagens disponíveis (mesmo paciente). */
  pool:    ImageMeta[];
  /** Mapa lesionId → bodyRegion para sugerir mesma região. */
  regionByLesion?: Record<string, string>;
  /** Pré-seleciona a foto da direita (depois). */
  initialRightId?: string | null;
}

interface ResolvedImage {
  meta: ImageMeta;
  url:  string | null;
}

/**
 * Comparador antes/depois com slider arrastável.
 *
 * Garante que ambas as fotos pertencem ao mesmo paciente (já implícito pelo
 * pool ser do paciente atual). Sugere a mesma região anatômica via mapa
 * lesionId → bodyRegion. Se não há ao menos 2 fotos, exibe empty state.
 */
export function PhotoCompareDialog({
  open,
  onClose,
  pool,
  regionByLesion,
  initialRightId,
}: PhotoCompareDialogProps) {
  const ordered = React.useMemo(() => {
    return [...pool].sort((a, b) => {
      const da = new Date(a.capturedAt).getTime();
      const db = new Date(b.capturedAt).getTime();
      return da - db;
    });
  }, [pool]);

  const [leftId,  setLeftId]  = React.useState<string | null>(null);
  const [rightId, setRightId] = React.useState<string | null>(null);
  const [pos,     setPos]     = React.useState(50);

  React.useEffect(() => {
    if (!open) {
      setPos(50);
      return;
    }
    // Inicialização: mais antiga vs mais recente (ou a foto pedida)
    if (ordered.length >= 2) {
      const right = initialRightId
        ? ordered.find((p) => p.id === initialRightId) ?? ordered[ordered.length - 1]
        : ordered[ordered.length - 1];
      const left = ordered
        .filter((p) => p.id !== right!.id)
        .find((p) =>
          regionFor(p, regionByLesion) ===
          regionFor(right!, regionByLesion),
        ) ?? ordered[0];
      setLeftId(left!.id);
      setRightId(right!.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ordered.length]);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const left  = ordered.find((p) => p.id === leftId)  ?? null;
  const right = ordered.find((p) => p.id === rightId) ?? null;

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Comparador antes e depois"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        padding: 24,
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: 1100, maxHeight: '92vh',
          background: '#fff', borderRadius: T.r.xl,
          boxShadow: T.shadow.xl, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <header style={{
          padding: '14px 20px',
          borderBottom: `1px solid ${T.divider}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <p style={{ fontSize: 17, fontWeight: 700, color: T.textPrimary }}>
              Antes / Depois
            </p>
            <Mono size={10} color={T.textMuted}>
              ARRASTE O SLIDER PARA REVELAR A EVOLUÇÃO
            </Mono>
          </div>
          <Btn variant="ghost" small icon="x" onClick={onClose}>Fechar</Btn>
        </header>

        {/* Pickers */}
        <div style={{
          padding: '12px 20px',
          borderBottom: `1px solid ${T.divider}`,
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
          background: T.glass,
        }}>
          <PickerColumn
            label="ANTES"
            color={T.warning}
            value={leftId}
            onChange={setLeftId}
            options={ordered}
            regionByLesion={regionByLesion}
            otherSelectedId={rightId}
          />
          <PickerColumn
            label="DEPOIS"
            color={T.success}
            value={rightId}
            onChange={setRightId}
            options={ordered}
            regionByLesion={regionByLesion}
            otherSelectedId={leftId}
          />
        </div>

        {/* Comparator */}
        {ordered.length < 2 ? (
          <div style={{
            flex: 1, padding: 40,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Ico name="image" size={36} color={T.textMuted} />
            <p style={{ fontSize: 14, color: T.textPrimary, fontWeight: 500 }}>
              Necessárias ao menos duas imagens para comparar.
            </p>
            <Mono size={10} color={T.textMuted}>
              FAÇA UPLOAD DE UMA FOTO ANTES E DEPOIS PARA INICIAR O ACOMPANHAMENTO.
            </Mono>
          </div>
        ) : (
          <div style={{
            flex: 1, overflow: 'auto', padding: 18,
            display: 'flex', flexDirection: 'column', gap: 12,
            background: '#0a0a0c',
          }}>
            <CompareSurface
              left={left}
              right={right}
              pos={pos}
              setPos={setPos}
              regionByLesion={regionByLesion}
            />
          </div>
        )}

        {/* Footer */}
        <footer style={{
          padding: '10px 20px',
          borderTop: `1px solid ${T.divider}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
        }}>
          <Mono size={9} color={T.textMuted}>
            POSIÇÃO: {Math.round(pos)}%
          </Mono>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={pos}
            onChange={(e) => setPos(Number(e.target.value))}
            aria-label="Posição do slider de comparação"
            style={{ flex: 1, accentColor: T.primary, maxWidth: 360 }}
          />
          <Btn variant="ghost" small onClick={() => setPos(50)}>Reset</Btn>
        </footer>
      </div>
    </div>
  );
}

/* ── Picker ─────────────────────────────────────────────────────── */

function PickerColumn({
  label, color, value, onChange, options, regionByLesion, otherSelectedId,
}: {
  label:   string;
  color:   string;
  value:   string | null;
  onChange: (id: string) => void;
  options: ImageMeta[];
  regionByLesion?: Record<string, string>;
  otherSelectedId: string | null;
}) {
  const selected = options.find((o) => o.id === value) ?? null;
  const other    = options.find((o) => o.id === otherSelectedId) ?? null;
  const otherRegion = other ? regionFor(other, regionByLesion) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Mono size={10} color={color} spacing="1px">{label}</Mono>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: '8px 10px', fontSize: 13,
          color: T.textPrimary, background: '#fff',
          border: `1px solid ${T.divider}`, borderRadius: T.r.md,
          outline: 'none', fontFamily: 'inherit',
        }}
      >
        <option value="" disabled>Selecione uma imagem</option>
        {options.map((o) => {
          const region = regionFor(o, regionByLesion);
          const sameRegion = otherRegion && region && otherRegion === region;
          const date = new Date(o.capturedAt).toLocaleDateString('pt-BR', {
            day: '2-digit', month: 'short', year: 'numeric',
          });
          return (
            <option key={o.id} value={o.id}>
              {date}{region ? ` · ${regionLabel(region)}` : ''}{sameRegion ? ' ✓' : ''}
            </option>
          );
        })}
      </select>
      {selected && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {selected.captureType && (
            <Badge variant="default" dot={false}>
              {selected.captureType.toUpperCase()}
            </Badge>
          )}
          {otherRegion && regionFor(selected, regionByLesion) !== otherRegion && (
            <Mono size={9} color={T.warning}>
              REGIÃO DIFERENTE
            </Mono>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Compare surface ────────────────────────────────────────────── */

function CompareSurface({
  left, right, pos, setPos, regionByLesion,
}: {
  left:  ImageMeta | null;
  right: ImageMeta | null;
  pos:   number;
  setPos: (n: number) => void;
  regionByLesion?: Record<string, string>;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const dragging     = React.useRef(false);
  const leftRes      = useResolvedImage(left);
  const rightRes     = useResolvedImage(right);

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

  const leftRegion  = left  ? regionFor(left,  regionByLesion) : null;
  const rightRegion = right ? regionFor(right, regionByLesion) : null;
  const regionMismatch = leftRegion && rightRegion && leftRegion !== rightRegion;

  return (
    <>
      {regionMismatch && (
        <div style={{
          padding: '8px 12px', borderRadius: T.r.md,
          background: T.warningBg, border: `1px solid ${T.warningBorder}`,
        }}>
          <Mono size={10} color={T.warning}>
            ATENÇÃO: AS IMAGENS SELECIONADAS PERTENCEM A REGIÕES DIFERENTES
            ({regionLabel(leftRegion!)} VS {regionLabel(rightRegion!)}).
          </Mono>
        </div>
      )}

      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="group"
        aria-label="Comparação antes e depois"
        style={{
          position: 'relative',
          aspectRatio: '4 / 3',
          maxHeight: '60vh',
          width: '100%',
          background: '#000',
          borderRadius: T.r.lg,
          overflow: 'hidden',
          userSelect: 'none',
          cursor: 'ew-resize',
        }}
      >
        {/* Right (depois) — fundo */}
        {rightRes.url ? (
          <img
            src={rightRes.url}
            alt={right?.altText ?? 'Depois'}
            draggable={false}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%', objectFit: 'contain',
              pointerEvents: 'none',
            }}
          />
        ) : (
          <EmptySide label="Selecione uma imagem (depois)" />
        )}

        {/* Left (antes) — clipado */}
        {leftRes.url && (
          <div
            style={{
              position: 'absolute', inset: 0,
              clipPath: `inset(0 ${100 - pos}% 0 0)`,
              pointerEvents: 'none',
            }}
          >
            <img
              src={leftRes.url}
              alt={left?.altText ?? 'Antes'}
              draggable={false}
              style={{
                width: '100%', height: '100%', objectFit: 'contain',
              }}
            />
          </div>
        )}

        {/* Slider line + handle */}
        <div
          style={{
            position: 'absolute', top: 0, bottom: 0, left: `${pos}%`,
            width: 2, background: T.primary,
            pointerEvents: 'none',
          }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute', top: '50%', left: `${pos}%`,
            transform: 'translate(-50%, -50%)',
            width: 36, height: 36, borderRadius: '50%',
            background: T.primary, border: '3px solid #fff',
            boxShadow: T.shadow.md,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <Ico name="layers" size={16} color="#fff" />
        </div>

        {/* Date overlays */}
        <DateOverlay position="left"  date={left?.capturedAt}  label="Antes" />
        <DateOverlay position="right" date={right?.capturedAt} label="Depois" />
      </div>
    </>
  );
}

function EmptySide({ label }: { label: string }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: 13,
    }}>
      {label}
    </div>
  );
}

function DateOverlay({
  position, date, label,
}: {
  position: 'left' | 'right'; date?: Date | string; label: string;
}) {
  const formatted = date
    ? new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
  return (
    <div style={{
      position: 'absolute', top: 10,
      [position]: 10,
      padding: '4px 10px',
      borderRadius: T.r.sm,
      background: 'rgba(0,0,0,0.6)',
      color: '#fff',
      fontSize: 11,
      fontFamily: "'IBM Plex Mono', monospace",
      letterSpacing: '0.04em',
    } as React.CSSProperties}>
      {label.toUpperCase()} · {formatted}
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function regionFor(img: ImageMeta, map?: Record<string, string>): string | null {
  if (!map) return null;
  const lesionId = (img as ImageMeta & { lesionId?: string | null }).lesionId;
  if (!lesionId) return null;
  return map[lesionId] ?? null;
}

/**
 * Garante que temos uma URL utilizável. Se a imagem não trouxer mediumUrl
 * (ainda processando ou TTL expirado), tenta gerar um presigned URL.
 */
function useResolvedImage(img: ImageMeta | null): ResolvedImage {
  const requestUrlMut = trpc.clinical.lesions.requestImageUrl.useMutation();
  const [url, setUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!img) { setUrl(null); return; }
    const direct = img.mediumUrl ?? img.originalUrl ?? img.thumbnailUrl;
    if (direct) { setUrl(direct); return; }
    let cancelled = false;
    requestUrlMut
      .mutateAsync({ imageId: img.id, variant: 'medium' })
      .then((res) => { if (!cancelled) setUrl(res.url); })
      .catch(() => { if (!cancelled) setUrl(null); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img?.id]);

  return { meta: img!, url };
}
