'use client';

import * as React from 'react';
import { Btn, Glass, Ico, Mono, Badge, EmptyState, Skeleton, T } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { regionLabel } from '@/components/lesions/body-regions';
import { usePermission } from '@/lib/auth';
import { ImageViewer, type ImageMeta } from './image-viewer';
import { PhotoUploadDialog } from './photo-upload-dialog';
import { PhotoCompareDialog } from './photo-compare-dialog';

interface TabImagensProps {
  patientId: string;
  /**
   * Sinal vindo do header/sidebar para abrir a UI de upload — o tab é
   * a fonte da verdade do estado do dialog. O incremento permite reabrir
   * o dialog mesmo quando já fechou anteriormente sem mudar o tab.
   */
  uploadSignal?: number;
}

const CAPTURE_LABEL: Record<string, string> = {
  clinical:    'Clínica',
  dermoscopy:  'Dermatoscopia',
  macro:       'Macro',
};

const CAPTURE_COLOR: Record<string, string> = {
  clinical:    T.clinical.color,
  dermoscopy:  T.aiMod.color,
  macro:       T.supply.color,
};

const PROCESSING_LABEL: Record<string, string> = {
  pending:           'Processando',
  processing:        'Processando',
  ready:             'Pronta',
  processing_failed: 'Falha',
  unprocessable:     'Inválida',
};

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toIsoDate(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

interface FilterState {
  captureType: string | null;
  region:      string | null;
  lesionId:    string | null;
  fromDate:    string;     // yyyy-mm-dd
  toDate:      string;
}

const EMPTY_FILTERS: FilterState = {
  captureType: null,
  region:      null,
  lesionId:    null,
  fromDate:    '',
  toDate:      '',
};

export function TabImagens({ patientId, uploadSignal }: TabImagensProps) {
  const canWrite  = usePermission('clinical', 'write');
  const canExport = usePermission('clinical', 'export');

  const [filters, setFilters]               = React.useState<FilterState>(EMPTY_FILTERS);
  const [uploadOpen, setUploadOpen]         = React.useState(false);
  const [compareOpen, setCompareOpen]       = React.useState(false);
  const [openImage, setOpenImage]           = React.useState<ImageMeta | null>(null);
  const [compareSeed, setCompareSeed]       = React.useState<string | null>(null);

  // Sinal externo (header/sidebar) abre o upload sem precisar de trocar de tab
  const lastSignal = React.useRef(0);
  React.useEffect(() => {
    if (uploadSignal && uploadSignal !== lastSignal.current) {
      lastSignal.current = uploadSignal;
      if (canWrite) setUploadOpen(true);
    }
  }, [uploadSignal, canWrite]);

  const utils = trpc.useUtils();

  const queryInput = React.useMemo(() => ({
    patientId,
    page:        1,
    pageSize:    50,
    captureType: filters.captureType as ('clinical' | 'dermoscopy' | 'macro') | undefined,
    lesionId:    filters.lesionId ?? undefined,
    fromDate:    filters.fromDate ? new Date(filters.fromDate) : undefined,
    toDate:      filters.toDate
      ? new Date(`${filters.toDate}T23:59:59.999Z`)
      : undefined,
  }), [patientId, filters]);

  const listQ = trpc.clinical.lesions.listPatientImages.useQuery(queryInput, {
    staleTime: 30_000,
  });

  const lesionsQ = trpc.clinical.lesions.listByPatient.useQuery(
    { patientId, includeDeleted: false },
    { staleTime: 60_000 },
  );

  const regionByLesion = React.useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const l of lesionsQ.data ?? []) map[l.id] = l.bodyRegion;
    return map;
  }, [lesionsQ.data]);

  const allItems = listQ.data?.data ?? [];

  // Filtro de região é client-side (backend não expõe filtro por bodyRegion)
  const items = React.useMemo<ImageMeta[]>(() => {
    if (!filters.region) return allItems as ImageMeta[];
    return (allItems as ImageMeta[]).filter((img) => {
      const lesionId = img.lesionId;
      if (!lesionId) return false;
      return regionByLesion[lesionId] === filters.region;
    });
  }, [allItems, filters.region, regionByLesion]);

  const availableRegions = React.useMemo(() => {
    const set = new Set<string>();
    for (const img of allItems as ImageMeta[]) {
      const r = img.lesionId ? regionByLesion[img.lesionId] : null;
      if (r) set.add(r);
    }
    return [...set];
  }, [allItems, regionByLesion]);

  const availableCaptureTypes = React.useMemo(() => {
    const set = new Set<string>();
    for (const img of allItems) {
      if (img.captureType) set.add(img.captureType);
    }
    return [...set];
  }, [allItems]);

  const filtersActive =
    filters.captureType !== null ||
    filters.region      !== null ||
    filters.lesionId    !== null ||
    filters.fromDate    !== ''   ||
    filters.toDate      !== '';

  const ready = !listQ.isLoading;

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
  }

  function openCompareFrom(img: ImageMeta) {
    setCompareSeed(img.id);
    setCompareOpen(true);
  }

  function refresh() {
    void utils.clinical.lesions.listPatientImages.invalidate({ patientId });
    void utils.clinical.lesions.listByPatient.invalidate({ patientId });
  }

  /* ── Loading ─────────────────────────────────────────────────────── */
  if (!ready) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} height={220} delay={i * 60} />
        ))}
      </div>
    );
  }

  /* ── Empty (no images at all) ────────────────────────────────────── */
  if (allItems.length === 0) {
    return (
      <>
        <EmptyState
          label="IMAGENS CLÍNICAS"
          icon="image"
          title="Nenhuma imagem clínica registrada"
          description="Fotos clínicas, dermatoscopias e acompanhamentos ficam aqui. Comece capturando a primeira imagem do paciente."
          action={canWrite && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <Btn small icon="image" onClick={() => setUploadOpen(true)}>Upload fotos clínicas</Btn>
            </div>
          )}
        />
        <PhotoUploadDialog
          open={uploadOpen}
          patientId={patientId}
          onClose={() => setUploadOpen(false)}
          onUploaded={() => { refresh(); }}
        />
      </>
    );
  }

  return (
    <>
      <Header
        total={allItems.length}
        filtered={items.length}
        canWrite={canWrite}
        canCompare={allItems.length >= 2}
        onUpload={() => setUploadOpen(true)}
        onCompare={() => { setCompareSeed(null); setCompareOpen(true); }}
      />

      <FiltersBar
        filters={filters}
        setFilters={setFilters}
        availableCaptureTypes={availableCaptureTypes}
        availableRegions={availableRegions}
        lesions={(lesionsQ.data ?? []).map((l) => ({
          id: l.id, bodyRegion: l.bodyRegion, status: l.status,
          description: l.description,
        }))}
        onClear={clearFilters}
        active={filtersActive}
      />

      {items.length === 0 ? (
        <EmptyState
          label="SEM RESULTADO"
          icon="filter"
          title="Nenhuma imagem corresponde ao filtro"
          description="Ajuste os filtros ou limpe-os para ver todas as imagens do paciente."
          action={
            <Btn small variant="ghost" icon="x" onClick={clearFilters}>Limpar filtros</Btn>
          }
        />
      ) : (
        <Grid
          items={items}
          regionByLesion={regionByLesion}
          onOpen={(img) => setOpenImage(img)}
          onCompareFrom={openCompareFrom}
          canExport={canExport}
        />
      )}

      <ImageViewer
        open={!!openImage}
        current={openImage}
        pool={items}
        onClose={() => setOpenImage(null)}
      />

      <PhotoCompareDialog
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        pool={items}
        regionByLesion={regionByLesion}
        initialRightId={compareSeed}
      />

      <PhotoUploadDialog
        open={uploadOpen}
        patientId={patientId}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => { refresh(); }}
      />
    </>
  );
}

/* ───────────────────────────── Header ───────────────────────────── */

function Header({
  total, filtered, canWrite, canCompare, onUpload, onCompare,
}: {
  total: number; filtered: number;
  canWrite: boolean; canCompare: boolean;
  onUpload: () => void; onCompare: () => void;
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 14, gap: 12, flexWrap: 'wrap',
    }}>
      <div>
        <p style={{ fontSize: 17, fontWeight: 600, color: T.textPrimary, marginBottom: 2 }}>
          Imagens clínicas
        </p>
        <Mono size={10} spacing="1.2px" color={T.textMuted}>
          {filtered === total
            ? `${total} ${total === 1 ? 'IMAGEM' : 'IMAGENS'}`
            : `${filtered} DE ${total}`}
        </Mono>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn
          variant="ghost"
          small
          icon="layers"
          onClick={onCompare}
          disabled={!canCompare}
          title={canCompare ? 'Comparar antes/depois' : 'É preciso ao menos 2 imagens'}
        >
          Comparar antes/depois
        </Btn>
        {canWrite && (
          <Btn small icon="image" onClick={onUpload}>
            Upload fotos
          </Btn>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────────── Filters ──────────────────────────── */

function FiltersBar({
  filters, setFilters, availableCaptureTypes, availableRegions, lesions, onClear, active,
}: {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  availableCaptureTypes: string[];
  availableRegions: string[];
  lesions: { id: string; bodyRegion: string; description: string | null; status: string }[];
  onClear: () => void;
  active: boolean;
}) {
  return (
    <Glass style={{
      padding: 12, marginBottom: 14,
      display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end',
    }}>
      {/* Capture type */}
      <FieldGroup label="Tipo">
        <select
          value={filters.captureType ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, captureType: e.target.value || null }))}
          style={selectStyle()}
          disabled={availableCaptureTypes.length === 0}
        >
          <option value="">Todos</option>
          {availableCaptureTypes.map((c) => (
            <option key={c} value={c}>{CAPTURE_LABEL[c] ?? c}</option>
          ))}
        </select>
      </FieldGroup>

      {/* Region */}
      <FieldGroup label="Região">
        <select
          value={filters.region ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, region: e.target.value || null }))}
          style={selectStyle()}
          disabled={availableRegions.length === 0}
        >
          <option value="">Todas</option>
          {availableRegions.map((r) => (
            <option key={r} value={r}>{regionLabel(r)}</option>
          ))}
        </select>
      </FieldGroup>

      {/* Lesion */}
      <FieldGroup label="Lesão">
        <select
          value={filters.lesionId ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, lesionId: e.target.value || null }))}
          style={selectStyle()}
          disabled={lesions.length === 0}
        >
          <option value="">Todas</option>
          {lesions.map((l) => (
            <option key={l.id} value={l.id}>
              {regionLabel(l.bodyRegion)} · {l.description?.slice(0, 40) || 'Sem descrição'}
            </option>
          ))}
        </select>
      </FieldGroup>

      {/* Date range */}
      <FieldGroup label="De">
        <input
          type="date"
          value={filters.fromDate}
          onChange={(e) => setFilters((f) => ({ ...f, fromDate: e.target.value }))}
          style={selectStyle()}
        />
      </FieldGroup>

      <FieldGroup label="Até">
        <input
          type="date"
          value={filters.toDate}
          onChange={(e) => setFilters((f) => ({ ...f, toDate: e.target.value }))}
          style={selectStyle()}
        />
      </FieldGroup>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        {active && (
          <Btn variant="ghost" small icon="x" onClick={onClear}>Limpar</Btn>
        )}
      </div>
    </Glass>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 130 }}>
      <Mono size={9} color={T.textMuted}>{label.toUpperCase()}</Mono>
      {children}
    </label>
  );
}

/* ───────────────────────────── Grid ─────────────────────────────── */

function Grid({
  items, regionByLesion, onOpen, onCompareFrom, canExport,
}: {
  items: ImageMeta[];
  regionByLesion: Record<string, string>;
  onOpen: (img: ImageMeta) => void;
  onCompareFrom: (img: ImageMeta) => void;
  canExport: boolean;
}) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14,
    }}>
      {items.map((img) => (
        <PhotoCard
          key={img.id}
          img={img}
          region={img.lesionId ? regionByLesion[img.lesionId] ?? null : null}
          onOpen={() => onOpen(img)}
          onCompare={() => onCompareFrom(img)}
          canExport={canExport}
        />
      ))}
    </div>
  );
}

/* ───────────────────────────── Card ─────────────────────────────── */

function PhotoCard({
  img, region, onOpen, onCompare, canExport,
}: {
  img: ImageMeta;
  region: string | null;
  onOpen: () => void;
  onCompare: () => void;
  canExport: boolean;
}) {
  const captureColor = img.captureType ? CAPTURE_COLOR[img.captureType] ?? T.textMuted : T.textMuted;
  const status = img.processingStatus ?? 'ready';
  const isProcessing = status === 'pending' || status === 'processing';
  const failed = status === 'processing_failed' || status === 'unprocessable';

  return (
    <Glass hover style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={img.altText ?? 'Imagem clínica'}
        style={{
          all: 'unset',
          height: 170,
          background: img.thumbnailUrl
            ? `center / cover url(${img.thumbnailUrl})`
            : `linear-gradient(145deg, ${T.clinical.bg}, ${T.glass})`,
          borderBottom: `1px solid ${T.divider}`,
          position: 'relative',
          cursor: 'pointer',
          display: 'block',
        }}
      >
        {!img.thumbnailUrl && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
            color: T.textMuted, fontSize: 12,
          }}>
            <Ico name="image" size={28} color={captureColor} />
            <Mono size={10} color={T.textMuted}>
              {isProcessing ? 'PROCESSANDO' : failed ? 'INDISPONÍVEL' : 'SEM PRÉVIA'}
            </Mono>
          </div>
        )}
        {img.captureType && (
          <div style={{
            position: 'absolute', top: 8, left: 8,
            padding: '3px 8px', borderRadius: T.r.sm,
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: `blur(${T.glassBlur}px) saturate(160%)`,
            WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(160%)`,
            border: `1px solid ${T.glassBorder}`,
          }}>
            <Mono size={9} color={captureColor}>
              {(CAPTURE_LABEL[img.captureType] ?? img.captureType).toUpperCase()}
            </Mono>
          </div>
        )}
        {(isProcessing || failed) && (
          <div style={{
            position: 'absolute', top: 8, right: 8,
          }}>
            <Badge variant={failed ? 'danger' : 'warning'} dot>
              {PROCESSING_LABEL[status]}
            </Badge>
          </div>
        )}
      </button>
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Mono size={10} color={T.textMuted}>
            {formatDate(img.capturedAt)}
          </Mono>
          {region && (
            <Mono size={9} color={T.textSecondary}>
              {regionLabel(region).toUpperCase()}
            </Mono>
          )}
        </div>
        {(img.notes ?? img.altText) && (
          <p style={{
            fontSize: 12, color: T.textSecondary, lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {img.notes ?? img.altText}
          </p>
        )}
        <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
          <Btn variant="ghost" small icon="eye" onClick={onOpen}>Abrir</Btn>
          <Btn variant="ghost" small icon="layers" onClick={onCompare}>Comparar</Btn>
          {/* TODO: download/export quando o backend expor canal auditado para o
              usuário final — hoje os presigned URLs já caem em logs HTTP, mas a
              ação de exportar PHI deve ser auditada no servidor. */}
          {canExport && (
            <Btn
              variant="ghost"
              small
              icon="download"
              disabled
              title="Exportação dependente de fluxo auditado — disponível em breve."
            >
              Baixar
            </Btn>
          )}
        </div>
      </div>
    </Glass>
  );
}

/* ───────────────────────────── helpers ──────────────────────────── */

function selectStyle(): React.CSSProperties {
  return {
    padding: '7px 9px',
    fontSize: 13,
    color: T.textPrimary,
    background: '#fff',
    border: `1px solid ${T.divider}`,
    borderRadius: T.r.md,
    outline: 'none',
    fontFamily: 'inherit',
    minWidth: 120,
  };
}
