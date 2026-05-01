'use client';

import * as React from 'react';
import { Btn, Glass, Ico, Mono, Badge, EmptyState, Skeleton, T } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { ImageViewer, type ImageMeta } from './image-viewer';

interface TabImagensProps {
  patientId: string;
  onUploadFotos?: () => void;
}

const CAPTURE_LABEL: Record<string, string> = {
  clinical:    'Clínica',
  dermoscopy:  'Dermoscopia',
  trichoscopy: 'Tricoscopia',
  pre:         'Pré-procedimento',
  post:        'Pós-procedimento',
  'follow-up': 'Acompanhamento',
};

const CAPTURE_COLOR: Record<string, string> = {
  clinical:    T.clinical.color,
  dermoscopy:  T.aiMod.color,
  trichoscopy: T.supply.color,
  pre:         T.warning,
  post:        T.success,
  'follow-up': T.info,
};

function formatDate(d: Date | string | null): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function TabImagens({ patientId, onUploadFotos }: TabImagensProps) {
  const listQ = trpc.clinical.lesions.listPatientImages.useQuery({
    patientId,
    page:     1,
    pageSize: 30,
  });

  const items = listQ.data?.data ?? [];
  const [openImage, setOpenImage] = React.useState<ImageMeta | null>(null);
  const [filterType, setFilterType] = React.useState<string | null>(null);

  if (listQ.isLoading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height={200} delay={i * 60} />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        label="IMAGENS CLÍNICAS"
        icon="image"
        title="Nenhuma imagem clínica"
        description="Fotos clínicas, dermoscópicas e de acompanhamento capturadas durante consultas aparecerão aqui."
        action={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            {onUploadFotos && (
              <Btn small icon="image" onClick={onUploadFotos}>Upload fotos clínicas</Btn>
            )}
          </div>
        }
      />
    );
  }

  const captureTypes = [...new Set(items.map((i) => i.captureType).filter(Boolean))] as string[];
  const filtered = filterType ? items.filter((i) => i.captureType === filterType) : items;

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Mono size={11} spacing="1.2px" color={T.primary}>
          {items.length} {items.length === 1 ? 'IMAGEM' : 'IMAGENS'}
        </Mono>
        {onUploadFotos && (
          <Btn variant="ghost" small icon="image" onClick={onUploadFotos}>Upload fotos</Btn>
        )}
      </div>

      {/* Filters */}
      {captureTypes.length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setFilterType(null)}
            style={{
              padding: '5px 12px',
              borderRadius: T.r.md,
              background: filterType === null ? T.primaryBg : 'transparent',
              border: `1px solid ${filterType === null ? T.primaryBorder : 'transparent'}`,
              color: filterType === null ? T.primary : T.textMuted,
              fontSize: 12,
              fontFamily: "'IBM Plex Mono', monospace",
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            TODAS ({items.length})
          </button>
          {captureTypes.map((ct) => {
            const count = items.filter((i) => i.captureType === ct).length;
            return (
              <button
                key={ct}
                type="button"
                onClick={() => setFilterType(ct)}
                style={{
                  padding: '5px 12px',
                  borderRadius: T.r.md,
                  background: filterType === ct ? T.primaryBg : 'transparent',
                  border: `1px solid ${filterType === ct ? T.primaryBorder : 'transparent'}`,
                  color: filterType === ct ? T.primary : T.textMuted,
                  fontSize: 11,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {(CAPTURE_LABEL[ct] ?? ct).toUpperCase()} ({count})
              </button>
            );
          })}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        {filtered.map((img) => {
          const color = CAPTURE_COLOR[img.captureType ?? ''] ?? T.textMuted;
          return (
            <Glass
              key={img.id}
              hover
              style={{ padding: 0, overflow: 'hidden', cursor: 'pointer' }}
              onClick={() => setOpenImage(img as ImageMeta)}
            >
              <div
                style={{
                  height: 160,
                  background: img.thumbnailUrl
                    ? `center / cover url(${img.thumbnailUrl})`
                    : `linear-gradient(145deg, ${T.clinical.bg}, ${T.glass})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderBottom: `1px solid ${T.divider}`,
                  position: 'relative',
                }}
              >
                {!img.thumbnailUrl && (
                  <div style={{ textAlign: 'center' }}>
                    <Ico name="image" size={32} color={color} />
                    <p style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>
                      {img.captureType ? CAPTURE_LABEL[img.captureType] ?? img.captureType : 'Imagem'}
                    </p>
                  </div>
                )}
                {img.captureType && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 8,
                      left: 8,
                      padding: '3px 8px',
                      borderRadius: T.r.sm,
                      background: T.glass,
                      backdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
                      WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
                      border: `1px solid ${T.glassBorder}`,
                    }}
                  >
                    <Mono size={9} color={color}>
                      {(CAPTURE_LABEL[img.captureType] ?? img.captureType).toUpperCase()}
                    </Mono>
                  </div>
                )}
              </div>
              <div style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Mono size={10}>{formatDate(img.capturedAt)}</Mono>
                  <Ico name="eye" size={14} color={T.textMuted} />
                </div>
                <p style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.5 }}>
                  {img.notes ?? img.altText ?? '—'}
                </p>
              </div>
            </Glass>
          );
        })}
      </div>

      <ImageViewer
        open={!!openImage}
        current={openImage}
        pool={items as ImageMeta[]}
        onClose={() => setOpenImage(null)}
      />
    </>
  );
}
