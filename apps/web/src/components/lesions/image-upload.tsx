'use client';

import * as React from 'react';
import { Camera, Upload, X } from 'lucide-react';
import { Button, useToast } from '@dermaos/ui';
import {
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  MAX_UPLOAD_BATCH_SIZE,
  type BodyRegion,
  type CaptureType,
  BODY_REGIONS,
} from '@dermaos/shared';
import { cn } from '@/lib/utils';
import { regionLabel } from './body-regions';

interface ImageUploadProps {
  patientId:        string;
  lesionId?:        string;
  defaultRegion?:   BodyRegion;
  onUploaded?:      (imageIds: string[]) => void;
}

interface PendingFile {
  id:       string;
  file:     File;
  progress: number;
  error?:   string;
}

const ACCEPT = [...ALLOWED_IMAGE_MIME_TYPES, ...ALLOWED_IMAGE_EXTENSIONS].join(',');

export function ImageUpload({
  patientId,
  lesionId,
  defaultRegion,
  onUploaded,
}: ImageUploadProps) {
  const { toast } = useToast();
  const [pending, setPending]       = React.useState<PendingFile[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [region, setRegion]         = React.useState<BodyRegion | ''>(defaultRegion ?? '');
  const [captureType, setCaptureType] = React.useState<CaptureType>('clinical');
  const [description, setDescription] = React.useState('');
  const [dragActive, setDragActive] = React.useState(false);
  const inputRef  = React.useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | File[]) {
    const items = Array.from(files);
    const errors: string[] = [];
    const accepted: PendingFile[] = [];

    for (const f of items) {
      if (pending.length + accepted.length >= MAX_UPLOAD_BATCH_SIZE) {
        errors.push(`Máximo de ${MAX_UPLOAD_BATCH_SIZE} imagens por upload.`);
        break;
      }
      if (f.size > MAX_IMAGE_SIZE_BYTES) {
        errors.push(`${f.name}: excede 25MB.`);
        continue;
      }
      const ext = '.' + (f.name.split('.').pop()?.toLowerCase() ?? '');
      if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext as (typeof ALLOWED_IMAGE_EXTENSIONS)[number])) {
        errors.push(`${f.name}: extensão não permitida.`);
        continue;
      }
      accepted.push({ id: crypto.randomUUID(), file: f, progress: 0 });
    }

    if (errors.length) toast.error('Alguns arquivos foram rejeitados', { description: errors.join('\n') });
    if (accepted.length) setPending((prev) => [...prev, ...accepted]);
  }

  function removeAt(id: string) {
    setPending((prev) => prev.filter((p) => p.id !== id));
  }

  async function submit() {
    if (submitting || pending.length === 0) return;
    if (!lesionId && !region) {
      toast.error('Selecione uma região corporal ou vincule a uma lesão existente.');
      return;
    }

    setSubmitting(true);
    const form = new FormData();
    form.append('patientId', patientId);
    if (lesionId) form.append('lesionId', lesionId);
    if (region)   form.append('bodyRegion', region);
    form.append('captureType', captureType);
    if (description) form.append('description', description);
    for (const p of pending) form.append('files', p.file, p.file.name);

    try {
      // XHR para obter progress (fetch streams não dão progresso estável no browser)
      const result = await xhrUpload('/api/clinical/lesion-images/upload', form, (loaded, total) => {
        const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
        setPending((prev) => prev.map((p) => ({ ...p, progress: pct })));
      });

      const ids = (result as { results?: Array<{ imageId: string }> }).results?.map((r) => r.imageId) ?? [];
      toast.success('Upload concluído', {
        description: `${ids.length} ${ids.length === 1 ? 'imagem enviada' : 'imagens enviadas'} — processando em segundo plano.`,
      });
      setPending([]);
      setDescription('');
      onUploaded?.(ids);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha no upload';
      toast.error('Upload falhou', { description: msg });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Região corporal{lesionId ? ' (opcional)' : ''}</span>
          <select
            className="rounded-md border border-border bg-card px-2 py-1.5 text-foreground"
            value={region}
            onChange={(e) => setRegion(e.target.value as BodyRegion)}
            disabled={!!lesionId}
          >
            <option value="" disabled>Selecionar</option>
            {BODY_REGIONS.map((r) => (
              <option key={r} value={r}>{regionLabel(r)}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Tipo de captura</span>
          <select
            className="rounded-md border border-border bg-card px-2 py-1.5 text-foreground"
            value={captureType}
            onChange={(e) => setCaptureType(e.target.value as CaptureType)}
          >
            <option value="clinical">Clínica</option>
            <option value="dermoscopy">Dermatoscopia</option>
            <option value="macro">Macro</option>
          </select>
        </label>
      </div>

      {!lesionId && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Descrição da lesão</span>
          <textarea
            className="rounded-md border border-border bg-card px-2 py-1.5 text-foreground min-h-[72px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Opcional — descreva morfologia, cor, tamanho…"
            maxLength={2000}
          />
        </label>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors',
          dragActive ? 'border-primary-500 bg-primary-50' : 'border-border bg-card',
        )}
      >
        <Upload size={22} className="text-muted-foreground" />
        <p className="text-sm text-foreground">Arraste imagens aqui ou</p>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
            <Upload size={14} /> Escolher arquivos
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
            <Camera size={14} /> Câmera
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          JPG, PNG, HEIC, WebP · máx. 25MB · até {MAX_UPLOAD_BATCH_SIZE} arquivos
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          // capture="environment" só funciona no mobile (abre câmera nativa)
          capture="environment"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {pending.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Arquivos selecionados">
          {pending.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-md border border-border bg-card p-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm truncate">{p.file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {(p.file.size / (1024 * 1024)).toFixed(1)} MB
                  </span>
                </div>
                <div className="mt-1 h-1 w-full overflow-hidden rounded bg-muted">
                  <div
                    className="h-full bg-primary-500 transition-[width]"
                    style={{ width: `${p.progress}%` }}
                    aria-label={`Progresso: ${p.progress}%`}
                  />
                </div>
                {p.error && <p className="mt-1 text-xs text-danger-500">{p.error}</p>}
              </div>
              <button
                type="button"
                aria-label={`Remover ${p.file.name}`}
                onClick={() => removeAt(p.id)}
                className="p-1 rounded hover:bg-hover"
                disabled={submitting}
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={submit}
          disabled={submitting || pending.length === 0}
          aria-busy={submitting}
        >
          {submitting ? 'Enviando…' : `Enviar ${pending.length || ''}`.trim()}
        </Button>
      </div>
    </div>
  );
}

function xhrUpload(
  url: string,
  form: FormData,
  onProgress: (loaded: number, total: number) => void,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded, e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { resolve({}); }
      } else {
        let msg = `HTTP ${xhr.status}`;
        try {
          const body = JSON.parse(xhr.responseText);
          if (body.message) msg = body.message;
        } catch { /* noop */ }
        reject(new Error(msg));
      }
    };
    xhr.onerror  = () => reject(new Error('Erro de rede durante o upload.'));
    xhr.ontimeout = () => reject(new Error('Tempo esgotado durante o upload.'));
    xhr.send(form);
  });
}
