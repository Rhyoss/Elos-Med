'use client';

import * as React from 'react';
import {
  Btn,
  EmptyState,
  Glass,
  Ico,
  Mono,
  PageHero,
  Skeleton,
  T,
} from '@dermaos/ui/ds';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  useToast,
} from '@dermaos/ui';
import type { BodyRegion, LesionStatus } from '@dermaos/shared';
import { trpc } from '@/lib/trpc-provider';
import { useRealtime } from '@/hooks/use-realtime';
import { BodyMap, aggregateLesionsByRegion } from '@/components/lesions/body-map';
import { LesionDetailPanel } from '@/components/lesions/lesion-detail-panel';
import { Gallery } from '@/components/lesions/gallery';
import { ImageUpload } from '@/components/lesions/image-upload';
import { ImageViewer } from '@/components/lesions/image-viewer';
import type { TimelineImage } from '@/components/lesions/lesion-timeline';

type StatusFilter = 'all' | LesionStatus;

const STATUS_OPTIONS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all',        label: 'Todas'         },
  { id: 'active',     label: 'Ativas'        },
  { id: 'monitoring', label: 'Monitoramento' },
  { id: 'resolved',   label: 'Resolvidas'    },
];

export default function ImagensPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: patientId } = React.use(params);
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [statusFilter, setStatusFilter]       = React.useState<StatusFilter>('all');
  const [selectedLesionId, setSelectedLesion] = React.useState<string | null>(null);
  const [uploadOpen, setUploadOpen]           = React.useState(false);
  const [uploadRegion, setUploadRegion]       = React.useState<BodyRegion | undefined>();
  const [viewer, setViewer]                   = React.useState<{ src: string; alt: string } | null>(null);

  const lesionsQuery = trpc.clinical.lesions.listByPatient.useQuery(
    { patientId, status: statusFilter === 'all' ? undefined : statusFilter },
    { enabled: !!patientId, staleTime: 10_000 },
  );

  const imagesQuery = trpc.clinical.lesions.listImages.useQuery(
    { lesionId: selectedLesionId ?? '', page: 1, pageSize: 50 },
    { enabled: !!selectedLesionId, staleTime: 10_000 },
  );

  const allImagesQuery = trpc.clinical.lesions.listPatientImages.useQuery(
    { patientId, page: 1, pageSize: 200 },
    { enabled: !!patientId, staleTime: 10_000 },
  );

  const requestUrlMut    = trpc.clinical.lesions.requestImageUrl.useMutation();
  const retryMut         = trpc.clinical.lesions.retryImageProcessing.useMutation();
  const resolveMut       = trpc.clinical.lesions.resolve.useMutation();
  const reactivateMut    = trpc.clinical.lesions.reactivate.useMutation();
  const setMonitoringMut = trpc.clinical.lesions.setMonitoring.useMutation();

  const lesions        = lesionsQuery.data ?? [];
  const selectedLesion = lesions.find((l) => l.id === selectedLesionId) ?? null;
  const lesionImages   = (imagesQuery.data?.data ?? []) as TimelineImage[];
  const galleryImages  = (allImagesQuery.data?.data ?? []) as TimelineImage[];

  useRealtime(
    [
      'lesion.created',
      'lesion.updated',
      'lesion.status_changed',
      'lesion.deleted',
      'lesion_image.uploaded',
      'lesion_image.processed',
      'lesion_image.failed',
    ],
    () => {
      void utils.clinical.lesions.listByPatient.invalidate({ patientId });
      void utils.clinical.lesions.listPatientImages.invalidate({ patientId });
      if (selectedLesionId) {
        void utils.clinical.lesions.listImages.invalidate({ lesionId: selectedLesionId });
      }
    },
  );

  const lesionsByRegion = React.useMemo(() => {
    const grouped: Record<string, typeof lesions> = {};
    for (const l of lesions) {
      (grouped[l.bodyRegion] ??= []).push(l);
    }
    return grouped;
  }, [lesions]);

  function handleSelectRegion(region: BodyRegion) {
    const regionLesions = lesionsByRegion[region] ?? [];
    if (regionLesions.length === 0) {
      setUploadRegion(region);
      setUploadOpen(true);
      return;
    }
    setSelectedLesion(regionLesions[0]!.id);
  }

  async function handleOpenImage(img: TimelineImage) {
    if (img.processingStatus !== 'ready') {
      toast({ title: 'Imagem ainda não pronta para visualização' });
      return;
    }
    try {
      const res = await requestUrlMut.mutateAsync({ imageId: img.id, variant: 'original' });
      setViewer({ src: res.url, alt: img.altText ?? 'Imagem clínica' });
    } catch (err) {
      toast({
        title:       'Não foi possível abrir a imagem',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant:     'destructive',
      });
    }
  }

  async function handleRetry(img: TimelineImage) {
    try {
      await retryMut.mutateAsync({ imageId: img.id });
      toast({ title: 'Reprocessamento iniciado' });
    } catch (err) {
      toast({
        title:       'Falha ao reprocessar',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant:     'destructive',
      });
    }
  }

  async function handleStatusChange(next: LesionStatus, reason: string) {
    if (!selectedLesion) return;
    try {
      const mutation =
        next === 'active'     ? reactivateMut    :
        next === 'monitoring' ? setMonitoringMut :
                                resolveMut;
      await mutation.mutateAsync({ id: selectedLesion.id, reason });
      toast({ title: 'Status atualizado' });
    } catch (err) {
      toast({
        title:       'Falha ao atualizar status',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant:     'destructive',
      });
    }
  }

  function handleUploaded() {
    setUploadOpen(false);
    setUploadRegion(undefined);
    toast({ title: 'Upload concluído', description: 'Processando em segundo plano.' });
  }

  const regionSummary = React.useMemo(() => aggregateLesionsByRegion(lesions), [lesions]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <header
        style={{
          padding: '16px 26px',
          borderBottom: `1px solid ${T.divider}`,
          flexShrink: 0,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'flex-end',
          justifyContent: 'space-between',
        }}
      >
        <PageHero
          eyebrow="BODY MAP · LESÕES · GALERIA"
          title="Imagens & Lesões"
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Filter chips */}
          <div
            style={{
              display: 'inline-flex',
              padding: 2,
              borderRadius: T.r.md,
              background: T.glass,
              border: `1px solid ${T.glassBorder}`,
            }}
            role="tablist"
            aria-label="Filtro de status"
          >
            {STATUS_OPTIONS.map((opt) => {
              const active = statusFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStatusFilter(opt.id)}
                  style={{
                    padding: '5px 11px',
                    borderRadius: T.r.sm,
                    border: 'none',
                    background: active ? T.primaryBg : 'transparent',
                    color: active ? T.primary : T.textMuted,
                    fontSize: 11,
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontWeight: active ? 600 : 500,
                    letterSpacing: '0.04em',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <Btn
            small
            icon="plus"
            onClick={() => {
              setUploadRegion(undefined);
              setUploadOpen(true);
            }}
          >
            Adicionar imagem
          </Btn>
        </div>
      </header>

      {/* Body map + detail panel */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <section
          aria-label="Mapa corporal"
          style={{
            flex: 1,
            minWidth: 0,
            overflowY: 'auto',
            padding: 24,
            borderRight: selectedLesionId ? `1px solid ${T.divider}` : 'none',
          }}
        >
          {lesionsQuery.isLoading ? (
            <Skeleton height={420} radius={16} />
          ) : (
            <Glass style={{ padding: 18, maxWidth: 360, margin: '0 auto' }}>
              <BodyMap
                regionSummary={regionSummary}
                selected={selectedLesion?.bodyRegion ?? null}
                onSelectRegion={handleSelectRegion}
                allowEmpty
              />
            </Glass>
          )}
        </section>

        {selectedLesionId ? (
          <LesionDetailPanel
            lesion={
              selectedLesion
                ? {
                    id:           selectedLesion.id,
                    patientId:    selectedLesion.patientId,
                    bodyRegion:   selectedLesion.bodyRegion,
                    status:       selectedLesion.status,
                    description:  selectedLesion.description,
                    morphology:   selectedLesion.morphology ?? [],
                    color:        selectedLesion.color ?? [],
                    sizeMm:       selectedLesion.sizeMm ?? null,
                    createdAt:    selectedLesion.createdAt,
                    imageCount:   selectedLesion.imageCount ?? 0,
                    statusReason: selectedLesion.statusReason ?? null,
                  }
                : null
            }
            images={lesionImages}
            imagesLoading={imagesQuery.isLoading}
            onClose={() => setSelectedLesion(null)}
            onOpenImage={handleOpenImage}
            onRetry={handleRetry}
            onStatusChange={handleStatusChange}
            onUploaded={() => {
              void utils.clinical.lesions.listImages.invalidate({ lesionId: selectedLesionId });
            }}
          />
        ) : (
          <aside
            style={{
              width: 320,
              flexShrink: 0,
              padding: 24,
              borderLeft: `1px solid ${T.divider}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Ico name="user" size={15} color={T.textMuted} />
              <Mono size={9} spacing="1px">SELEÇÃO</Mono>
            </div>
            <p style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.5, margin: 0 }}>
              Clique em uma região do mapa corporal para ver detalhes e histórico das lesões cadastradas.
            </p>
          </aside>
        )}
      </div>

      {/* Gallery — todas as imagens do paciente */}
      <section
        aria-label="Galeria"
        style={{
          padding: '18px 26px',
          borderTop: `1px solid ${T.divider}`,
          flexShrink: 0,
          maxHeight: '38%',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Ico name="image" size={15} color={T.clinical.color} />
            <Mono size={9} spacing="1px" color={T.clinical.color}>
              GALERIA DO PACIENTE
            </Mono>
          </div>
          <Mono size={9}>{allImagesQuery.data?.total ?? 0} IMAGENS</Mono>
        </div>
        {allImagesQuery.isLoading ? (
          <Skeleton height={120} radius={16} />
        ) : galleryImages.length === 0 ? (
          <Glass style={{ padding: 24 }}>
            <EmptyState
              icon="image"
              title="Nenhuma imagem registrada"
              description="Use o botão 'Adicionar imagem' para registrar a primeira foto clínica."
            />
          </Glass>
        ) : (
          <Gallery images={galleryImages} onOpen={handleOpenImage} />
        )}
      </section>

      {/* Upload dialog (legacy primitive — Dialog DS pendente) */}
      <DialogRoot open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Adicionar imagens</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <ImageUpload
              patientId={patientId}
              defaultRegion={uploadRegion}
              onUploaded={handleUploaded}
            />
          </div>
        </DialogContent>
      </DialogRoot>

      {viewer && (
        <ImageViewer
          src={viewer.src}
          alt={viewer.alt}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}
