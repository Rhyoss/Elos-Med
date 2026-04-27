'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button, LoadingSkeleton } from '@dermaos/ui';
import type { LesionStatus } from '@dermaos/shared';
import { LesionTimeline, type TimelineImage } from './lesion-timeline';
import { ImageCompare } from './image-compare';
import { ImageUpload } from './image-upload';
import { regionLabel } from './body-regions';
import { cn } from '@/lib/utils';

interface Lesion {
  id:            string;
  patientId:     string;
  bodyRegion:    string;
  status:        LesionStatus;
  description:   string | null;
  morphology:    string[];
  color:         string[];
  sizeMm:        number | null;
  createdAt:     Date | string;
  imageCount:    number;
  statusReason:  string | null;
}

interface LesionDetailPanelProps {
  lesion:        Lesion | null;
  images:        TimelineImage[];
  imagesLoading: boolean;
  onClose:       () => void;
  onOpenImage:   (img: TimelineImage) => void;
  onRetry:       (img: TimelineImage) => void;
  onStatusChange: (status: LesionStatus, reason: string) => void;
  onUploaded:    () => void;
}

const STATUS_LABEL: Record<LesionStatus, string> = {
  active: 'Ativa', monitoring: 'Monitoramento', resolved: 'Resolvida',
};
const STATUS_STYLE: Record<LesionStatus, string> = {
  active:     'bg-danger-100 text-danger-700 border-danger-500/30',
  monitoring: 'bg-warning-100 text-warning-700 border-warning-500/30',
  resolved:   'bg-success-100 text-success-700 border-success-500/30',
};

export function LesionDetailPanel({
  lesion, images, imagesLoading, onClose,
  onOpenImage, onRetry, onStatusChange, onUploaded,
}: LesionDetailPanelProps) {
  const [tab, setTab] = React.useState<'timeline' | 'compare' | 'upload'>('timeline');
  const [left, setLeft]   = React.useState<TimelineImage | null>(null);
  const [right, setRight] = React.useState<TimelineImage | null>(null);
  const [showStatusForm, setShowStatusForm] = React.useState<LesionStatus | null>(null);
  const [reason, setReason] = React.useState('');

  React.useEffect(() => {
    const ready = images.filter((i) => i.processingStatus === 'ready');
    setLeft(ready[ready.length - 1] ?? null);
    setRight(ready[0] ?? null);
  }, [images]);

  if (!lesion) {
    return (
      <aside className="w-full max-w-md shrink-0 border-l border-border bg-card p-4">
        <LoadingSkeleton className="h-6 w-40 rounded mb-3" />
        <LoadingSkeleton className="h-4 w-60 rounded mb-6" />
        <LoadingSkeleton className="h-32 w-full rounded" />
      </aside>
    );
  }

  return (
    <aside
      className="flex w-full max-w-md shrink-0 flex-col border-l border-border bg-card"
      aria-labelledby="lesion-panel-title"
    >
      <header className="flex items-start justify-between gap-3 border-b border-border p-4">
        <div className="min-w-0">
          <h2 id="lesion-panel-title" className="text-base font-semibold text-foreground">
            {regionLabel(lesion.bodyRegion)}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Registrada em {format(toDate(lesion.createdAt), "dd 'de' MMMM yyyy", { locale: ptBR })}
          </p>
          <span
            className={cn(
              'mt-2 inline-block rounded-full border px-2 py-0.5 text-xs font-medium',
              STATUS_STYLE[lesion.status],
            )}
          >
            {STATUS_LABEL[lesion.status]}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fechar painel">
          Fechar
        </Button>
      </header>

      <div className="border-b border-border px-4 py-3 text-sm">
        <dl className="grid grid-cols-2 gap-y-1">
          {lesion.description && (
            <div className="col-span-2">
              <dt className="text-muted-foreground text-xs">Descrição</dt>
              <dd className="mt-0.5">{lesion.description}</dd>
            </div>
          )}
          {lesion.morphology.length > 0 && (
            <div>
              <dt className="text-muted-foreground text-xs">Morfologia</dt>
              <dd className="mt-0.5">{lesion.morphology.join(', ')}</dd>
            </div>
          )}
          {lesion.sizeMm != null && (
            <div>
              <dt className="text-muted-foreground text-xs">Tamanho</dt>
              <dd className="mt-0.5">{lesion.sizeMm} mm</dd>
            </div>
          )}
        </dl>

        <div className="mt-3 flex flex-wrap gap-2">
          {lesion.status !== 'active' && (
            <Button size="sm" variant="secondary" onClick={() => setShowStatusForm('active')}>
              Reativar
            </Button>
          )}
          {lesion.status !== 'monitoring' && (
            <Button size="sm" variant="secondary" onClick={() => setShowStatusForm('monitoring')}>
              Em monitoramento
            </Button>
          )}
          {lesion.status !== 'resolved' && (
            <Button size="sm" variant="secondary" onClick={() => setShowStatusForm('resolved')}>
              Marcar como resolvida
            </Button>
          )}
        </div>

        {showStatusForm && (
          <form
            className="mt-3 flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (reason.trim().length < 3) return;
              onStatusChange(showStatusForm, reason.trim());
              setReason('');
              setShowStatusForm(null);
            }}
          >
            <label className="text-xs text-muted-foreground">
              Motivo para mudar para “{STATUS_LABEL[showStatusForm]}”
            </label>
            <textarea
              required
              minLength={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[60px] rounded-md border border-border bg-background px-2 py-1 text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" type="button" onClick={() => { setShowStatusForm(null); setReason(''); }}>
                Cancelar
              </Button>
              <Button size="sm" type="submit">Confirmar</Button>
            </div>
          </form>
        )}
      </div>

      <nav className="flex border-b border-border" role="tablist" aria-label="Ações da lesão">
        {([
          ['timeline', 'Timeline'],
          ['compare',  'Comparar'],
          ['upload',   'Adicionar'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={cn(
              'flex-1 px-3 py-2 text-sm border-b-2 transition-colors',
              tab === key
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'timeline' && (
          <LesionTimeline
            images={images}
            loading={imagesLoading}
            onSelect={onOpenImage}
            onRetry={onRetry}
          />
        )}
        {tab === 'compare' && (
          <ImageCompare
            left={left}
            right={right}
            images={images.filter((i) => i.processingStatus === 'ready')}
            onChangeLeft={setLeft}
            onChangeRight={setRight}
          />
        )}
        {tab === 'upload' && (
          <ImageUpload
            patientId={lesion.patientId}
            lesionId={lesion.id}
            onUploaded={onUploaded}
          />
        )}
      </div>
    </aside>
  );
}

function toDate(v: Date | string): Date {
  return typeof v === 'string' ? new Date(v) : v;
}
