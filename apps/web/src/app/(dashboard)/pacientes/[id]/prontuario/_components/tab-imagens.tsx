'use client';

import * as React from 'react';
import { Glass, Ico, Mono, T } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { ImageViewer, type ImageMeta } from './image-viewer';

interface TabImagensProps {
  patientId: string;
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

export function TabImagens({ patientId }: TabImagensProps) {
  const listQ = trpc.clinical.lesions.listPatientImages.useQuery({
    patientId,
    page:     1,
    pageSize: 30,
  });

  const items = listQ.data?.data ?? [];
  const [openImage, setOpenImage] = React.useState<ImageMeta | null>(null);

  if (listQ.isLoading) {
    return <p style={{ fontSize: 12, color: T.textMuted }}>Carregando imagens…</p>;
  }
  if (items.length === 0) {
    return <p style={{ fontSize: 12, color: T.textMuted }}>Nenhuma imagem clínica capturada.</p>;
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {items.map((img) => (
          <Glass
            key={img.id}
            hover
            style={{ padding: 0, overflow: 'hidden', cursor: 'pointer' }}
            onClick={() => setOpenImage(img as ImageMeta)}
          >
            <div
              style={{
                height: 140,
                background: img.thumbnailUrl
                  ? `center / cover url(${img.thumbnailUrl})`
                  : `linear-gradient(145deg, ${T.clinical.bg}, ${T.glass})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderBottom: `1px solid ${T.divider}`,
              }}
            >
              {!img.thumbnailUrl && (
                <div style={{ textAlign: 'center' }}>
                  <Ico name="image" size={32} color={T.clinical.color} />
                  <p style={{ fontSize: 10, color: T.textMuted, marginTop: 4 }}>
                    {img.captureType ? CAPTURE_LABEL[img.captureType] ?? img.captureType : 'Imagem'}
                  </p>
                </div>
              )}
            </div>
            <div style={{ padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Mono size={8} color={T.primary}>
                  {img.captureType ? (CAPTURE_LABEL[img.captureType] ?? img.captureType).toUpperCase() : 'IMAGEM'}
                </Mono>
                <Mono size={8}>{formatDate(img.capturedAt)}</Mono>
              </div>
              <p style={{ fontSize: 11, color: T.textSecondary, lineHeight: 1.5 }}>
                {img.notes ?? img.altText ?? '—'}
              </p>
            </div>
          </Glass>
        ))}
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
