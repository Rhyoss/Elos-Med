'use client';

import * as React from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageViewerProps {
  src:      string;
  alt:      string;
  onClose?: () => void;
}

const MAX_ZOOM = 10;
const MIN_ZOOM = 1;

/**
 * Viewer com zoom, pan, rotate, fullscreen. Limita zoom ≤ 10x para não estourar
 * memória com imagens de alta resolução. Gestos touch via pointer events.
 */
export function ImageViewer({ src, alt, onClose }: ImageViewerProps) {
  const [zoom, setZoom]           = React.useState(1);
  const [rotation, setRotation]   = React.useState(0);
  const [offset, setOffset]       = React.useState({ x: 0, y: 0 });
  const containerRef              = React.useRef<HTMLDivElement>(null);
  const pointerState              = React.useRef<{
    active: boolean; startX: number; startY: number; origX: number; origY: number;
  }>({ active: false, startX: 0, startY: 0, origX: 0, origY: 0 });

  const zoomIn  = () => setZoom((z) => Math.min(z + 0.5, MAX_ZOOM));
  const zoomOut = () => setZoom((z) => Math.max(z - 0.5, MIN_ZOOM));
  const rotate  = () => setRotation((r) => (r + 90) % 360);
  const reset   = () => { setZoom(1); setRotation(0); setOffset({ x: 0, y: 0 }); };

  function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      void el.requestFullscreen?.();
    } else {
      void document.exitFullscreen?.();
    }
  }

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomIn(); }
      else if (e.key === '-')              { e.preventDefault(); zoomOut(); }
      else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); rotate(); }
      else if (e.key === 'Escape' && onClose) { onClose(); }
      else if (e.key === '0')              { reset(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (zoom <= 1) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    pointerState.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origX:  offset.x,
      origY:  offset.y,
    };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointerState.current.active) return;
    const dx = e.clientX - pointerState.current.startX;
    const dy = e.clientY - pointerState.current.startY;
    setOffset({ x: pointerState.current.origX + dx, y: pointerState.current.origY + dy });
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    pointerState.current.active = false;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  }

  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.3 : 0.3;
    setZoom((z) => Math.min(Math.max(z + delta, MIN_ZOOM), MAX_ZOOM));
  }

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full flex-col bg-black"
      role="dialog"
      aria-label="Visualizador de imagem clínica"
    >
      <div className="flex items-center justify-between gap-2 px-4 py-2 bg-zinc-900 text-zinc-100">
        <div className="text-sm truncate">{alt}</div>
        <div className="flex items-center gap-1">
          <button aria-label="Diminuir zoom"    onClick={zoomOut}       className="p-2 rounded hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white"><ZoomOut size={16} /></button>
          <span className="text-xs px-1 tabular-nums w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button aria-label="Aumentar zoom"    onClick={zoomIn}        className="p-2 rounded hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white"><ZoomIn size={16} /></button>
          <button aria-label="Rotacionar"       onClick={rotate}        className="p-2 rounded hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white"><RotateCw size={16} /></button>
          <button aria-label="Tela cheia"       onClick={toggleFullscreen} className="p-2 rounded hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white"><Maximize2 size={16} /></button>
          {onClose && (
            <button aria-label="Fechar" onClick={onClose} className="p-2 rounded hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white"><X size={16} /></button>
          )}
        </div>
      </div>

      <div
        className="flex-1 overflow-hidden flex items-center justify-center touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onDoubleClick={() => (zoom === 1 ? zoomIn() : reset())}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className={cn(
            'max-h-full max-w-full select-none transition-transform duration-100',
            zoom > 1 && 'cursor-grab active:cursor-grabbing',
          )}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg) scale(${zoom})`,
          }}
        />
      </div>
    </div>
  );
}
