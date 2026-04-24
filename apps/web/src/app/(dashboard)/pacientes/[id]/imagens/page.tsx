'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import {
  Button,
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  EmptyState,
  LoadingSkeleton,
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
import { cn } from '@/lib/utils';

type StatusFilter = 'all' | LesionStatus;

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

  /* ── Queries ───────────────────────────────────────────────────────── */
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

  const requestUrlMut     = trpc.clinical.lesions.requestImageUrl.useMutation();
  const retryMut          = trpc.clinical.lesions.retryImageProcessing.useMutation();
  const resolveMut        = trpc.clinical.lesions.resolve.useMutation();
  const reactivateMut     = trpc.clinical.lesions.reactivate.useMutation();
  const setMonitoringMut  = trpc.clinical.lesions.setMonitoring.useMutation();

  const lesions          = lesionsQuery.data ?? [];
  const selectedLesion   = lesions.find((l) => l.id === selectedLesionId) ?? null;
  const lesionImages     = (imagesQuery.data?.data ?? []) as TimelineImage[];
  const galleryImages    = (allImagesQuery.data?.data ?? []) as TimelineImage[];

  /* ── Realtime — invalida queries ao receber eventos ───────────────── */
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

  /* ── Handlers ─────────────────────────────────────────────────────── */
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
    if (regionLesions.length === 1) {
      setSelectedLesion(regionLesions[0]!.id);
      return;
    }
    setSelectedLesion(regionLesions[0]!.id);
  }

  async function handleOpenImage(img: TimelineImage) {
    if (img.processingStatus !== 'ready') {
      toast.info('Imagem ainda não pronta para visualização');
      return;
    }
    try {
      const res = await requestUrlMut.mutateAsync({ imageId: img.id, variant: 'original' });
      setViewer({ src: res.url, alt: img.altText ?? 'Imagem clínica' });
    } catch (err) {
      toast.error('Não foi possível abrir a imagem', {
        description: err instanceof Error ? err.message : 'Erro desconhecido',
      });
    }
  }

  async function handleRetry(img: TimelineImage) {
    try {
      await retryMut.mutateAsync({ imageId: img.id });
      toast.success('Reprocessamento iniciado');
    } catch (err) {
      toast.error('Falha ao reprocessar', {
        description: err instanceof Error ? err.message : 'Erro desconhecido',
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
      toast.success('Status atualizado');
    } catch (err) {
      toast.error('Falha ao atualizar status', {
        description: err instanceof Error ? err.message : 'Erro desconhecido',
      });
    }
  }

  function handleUploaded() {
    setUploadOpen(false);
    setUploadRegion(undefined);
    toast.success('Upload concluído — processando em segundo plano');
  }

  const regionSummary = React.useMemo(() => aggregateLesionsByRegion(lesions), [lesions]);

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-6 py-3">
        <div>
          <h1 className="text-base font-semibold text-foreground">Imagens & Lesões</h1>
          <p className="text-xs text-muted-foreground">
            Body map, timeline de lesões e galeria de fotos clínicas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusFilterTabs value={statusFilter} onChange={setStatusFilter} />
          <Button
            size="sm"
            onClick={() => { setUploadRegion(undefined); setUploadOpen(true); }}
          >
            <Plus size={14} /> Adicionar imagem
          </Button>
        </div>
      </header>

      {/* Body map + detail panel */}
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        <section
          aria-label="Mapa corporal"
          className="flex-1 min-w-0 overflow-y-auto border-b border-border p-6 lg:border-b-0 lg:border-r"
        >
          {lesionsQuery.isLoading ? (
            <LoadingSkeleton className="h-[420px] w-full max-w-[320px] mx-auto rounded-lg" />
          ) : (
            <BodyMap
              regionSummary={regionSummary}
              selected={selectedLesion?.bodyRegion ?? null}
              onSelectRegion={handleSelectRegion}
              allowEmpty
            />
          )}
        </section>

        {selectedLesionId ? (
          <LesionDetailPanel
            lesion={selectedLesion ? {
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
            } : null}
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
          <aside className="hidden w-full max-w-md shrink-0 border-l border-border bg-card p-6 text-sm text-muted-foreground lg:block">
            Selecione uma região no mapa para ver detalhes e histórico da lesão.
          </aside>
        )}
      </div>

      {/* Gallery — todas as imagens do paciente */}
      <section aria-label="Galeria" className="border-t border-border bg-background p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Galeria do paciente</h2>
          <span className="text-xs text-muted-foreground">
            {allImagesQuery.data?.total ?? 0} imagens
          </span>
        </div>
        {allImagesQuery.isLoading ? (
          <Gallery images={[]} loading />
        ) : galleryImages.length === 0 ? (
          <EmptyState
            title="Nenhuma imagem registrada para este paciente."
            description="Use o botão “Adicionar imagem” para registrar a primeira foto clínica."
          />
        ) : (
          <Gallery images={galleryImages} onOpen={handleOpenImage} />
        )}
      </section>

      {/* Upload dialog */}
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

      {/* Fullscreen viewer */}
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

/* ── StatusFilter ──────────────────────────────────────────────────── */

function StatusFilterTabs({
  value, onChange,
}: {
  value:    StatusFilter;
  onChange: (v: StatusFilter) => void;
}) {
  const options: Array<[StatusFilter, string]> = [
    ['all',        'Todas'],
    ['active',     'Ativas'],
    ['monitoring', 'Monitoramento'],
    ['resolved',   'Resolvidas'],
  ];
  return (
    <div role="tablist" aria-label="Filtro por status" className="inline-flex rounded-md border border-border bg-card p-0.5">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          className={cn(
            'rounded px-2 py-1 text-xs transition-colors',
            value === v
              ? 'bg-primary-600 text-white'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
