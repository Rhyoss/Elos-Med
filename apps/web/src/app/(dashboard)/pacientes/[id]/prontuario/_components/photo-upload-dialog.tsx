'use client';

import * as React from 'react';
import { Btn, Glass, Ico, Mono, Badge, T } from '@dermaos/ui/ds';
import { useToast } from '@dermaos/ui';
import {
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  MAX_UPLOAD_BATCH_SIZE,
  BODY_REGIONS,
  type BodyRegion,
  type CaptureType,
} from '@dermaos/shared';
import { trpc } from '@/lib/trpc-provider';
import { regionLabel } from '@/components/lesions/body-regions';

interface PhotoUploadDialogProps {
  open:        boolean;
  patientId:   string;
  /** Quando aberto a partir de uma consulta, vincula automaticamente. */
  encounterId?: string;
  /** Quando aberto a partir de uma lesão existente. */
  lesionId?:   string;
  /** Pré-seleciona a região (ex.: do body map). */
  defaultRegion?: BodyRegion;
  onClose: () => void;
  onUploaded?: (imageIds: string[]) => void;
}

interface PendingFile {
  id:       string;
  file:     File;
  preview:  string;
  progress: number;
  error?:   string;
}

interface LesionOption {
  id:         string;
  bodyRegion: string;
  description: string | null;
  status:     string;
}

const ACCEPT = [...ALLOWED_IMAGE_MIME_TYPES, ...ALLOWED_IMAGE_EXTENSIONS].join(',');

const CAPTURE_OPTIONS: { value: CaptureType; label: string; hint: string }[] = [
  { value: 'clinical',   label: 'Clínica',        hint: 'Foto a olho nu.'   },
  { value: 'dermoscopy', label: 'Dermatoscopia',  hint: 'Imagem com dermatoscópio.' },
  { value: 'macro',      label: 'Macro',          hint: 'Aproximação sem dermatoscopia.' },
];

/**
 * Modal de upload de imagens clínicas com drag-and-drop, validação de
 * tipo/tamanho, progresso por batch e vínculo opcional a lesão/consulta.
 *
 * Usa o endpoint REST multipart `/api/clinical/lesion-images/upload`
 * (autenticado pelo mesmo cookie JWT do tRPC).
 */
export function PhotoUploadDialog({
  open,
  patientId,
  encounterId,
  lesionId,
  defaultRegion,
  onClose,
  onUploaded,
}: PhotoUploadDialogProps) {
  const { toast } = useToast();
  const inputRef  = React.useRef<HTMLInputElement>(null);

  const [pending,     setPending]     = React.useState<PendingFile[]>([]);
  const [submitting,  setSubmitting]  = React.useState(false);
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [dragActive,  setDragActive]  = React.useState(false);
  const [region,      setRegion]      = React.useState<BodyRegion | ''>(defaultRegion ?? '');
  const [captureType, setCaptureType] = React.useState<CaptureType>('clinical');
  const [equipment,   setEquipment]   = React.useState('');
  const [notes,       setNotes]       = React.useState('');
  const [description, setDescription] = React.useState('');
  const [linkLesion,  setLinkLesion]  = React.useState<string>(lesionId ?? '');
  const [consent,     setConsent]     = React.useState(false);

  // Lesões existentes para vincular (em vez de criar uma nova)
  const lesionsQ = trpc.clinical.lesions.listByPatient.useQuery(
    { patientId, includeDeleted: false },
    { enabled: open && !!patientId, staleTime: 60_000 },
  );

  const lesions: LesionOption[] = React.useMemo(() => {
    return (lesionsQ.data ?? [])
      .filter((l) => l.status !== 'resolved')
      .map((l) => ({
        id:          l.id,
        bodyRegion:  l.bodyRegion,
        description: l.description,
        status:      l.status,
      }));
  }, [lesionsQ.data]);

  /* ── Reset state on close ────────────────────────────────────────── */
  React.useEffect(() => {
    if (open) return;
    pending.forEach((p) => URL.revokeObjectURL(p.preview));
    setPending([]);
    setSubmitting(false);
    setGlobalError(null);
    setRegion(defaultRegion ?? '');
    setCaptureType('clinical');
    setEquipment('');
    setNotes('');
    setDescription('');
    setLinkLesion(lesionId ?? '');
    setConsent(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, submitting, onClose]);

  /* ── File handling ───────────────────────────────────────────────── */
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
      const dot = f.name.lastIndexOf('.');
      const ext = (dot >= 0 ? f.name.slice(dot) : '').toLowerCase();
      if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext as (typeof ALLOWED_IMAGE_EXTENSIONS)[number])) {
        errors.push(`${f.name}: extensão não permitida.`);
        continue;
      }
      accepted.push({
        id:       crypto.randomUUID(),
        file:     f,
        preview:  URL.createObjectURL(f),
        progress: 0,
      });
    }

    if (errors.length) setGlobalError(errors.join(' · '));
    if (accepted.length) {
      setGlobalError(null);
      setPending((prev) => [...prev, ...accepted]);
    }
  }

  function removeAt(id: string) {
    setPending((prev) => {
      const found = prev.find((p) => p.id === id);
      if (found) URL.revokeObjectURL(found.preview);
      return prev.filter((p) => p.id !== id);
    });
  }

  /* ── Submit ──────────────────────────────────────────────────────── */
  async function submit() {
    if (submitting || pending.length === 0) return;

    if (!linkLesion && !region) {
      setGlobalError('Selecione uma região corporal ou vincule a uma lesão existente.');
      return;
    }
    if (!consent) {
      setGlobalError('É necessário confirmar o consentimento do paciente para registro de imagens clínicas.');
      return;
    }

    setSubmitting(true);
    setGlobalError(null);

    const form = new FormData();
    form.append('patientId', patientId);
    if (linkLesion)        form.append('lesionId',    linkLesion);
    if (region && !linkLesion) form.append('bodyRegion', region);
    form.append('captureType', captureType);
    if (equipment.trim())  form.append('equipment',  equipment.trim());
    if (notes.trim())      form.append('notes',      notes.trim());
    if (description.trim() && !linkLesion) form.append('description', description.trim());
    if (encounterId)       form.append('encounterId', encounterId);
    for (const p of pending) form.append('files', p.file, p.file.name);

    try {
      const result = await xhrUpload(
        '/api/clinical/lesion-images/upload',
        form,
        (loaded, total) => {
          const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
          setPending((prev) => prev.map((p) => ({ ...p, progress: pct })));
        },
      );

      const ids = (result as { results?: Array<{ imageId: string }> }).results?.map((r) => r.imageId) ?? [];
      toast.success('Upload concluído', {
        description: `${ids.length} ${ids.length === 1 ? 'imagem enviada' : 'imagens enviadas'} — processando em segundo plano.`,
      });
      onUploaded?.(ids);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha no upload.';
      setGlobalError(msg);
      toast.error('Upload falhou', { description: msg });
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const totalBytes  = pending.reduce((acc, p) => acc + p.file.size, 0);
  const sizeLabel   = (totalBytes / (1024 * 1024)).toFixed(1) + ' MB';
  const linkedLesion = lesions.find((l) => l.id === linkLesion) ?? null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Upload de imagens clínicas"
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        padding: 24,
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: 720, maxHeight: '92vh',
          background: '#fff', borderRadius: T.r.xl,
          boxShadow: T.shadow.xl, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <header style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${T.divider}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <p style={{ fontSize: 17, fontWeight: 700, color: T.textPrimary }}>
              Upload de imagens clínicas
            </p>
            <Mono size={10} color={T.textMuted}>
              {pending.length} {pending.length === 1 ? 'ARQUIVO' : 'ARQUIVOS'} · {sizeLabel}
              {encounterId ? ' · vinculado à consulta' : ''}
            </Mono>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Fechar"
            style={{ background: 'none', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', padding: 4 }}
          >
            <Ico name="x" size={20} color={T.textMuted} />
          </button>
        </header>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault(); setDragActive(false);
              if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
            }}
            style={{
              borderRadius: T.r.lg,
              border: `2px dashed ${dragActive ? T.primary : T.glassBorder}`,
              background: dragActive ? T.primaryBg : T.glass,
              padding: 24,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); }
            }}
          >
            <Ico name="image" size={28} color={T.primary} />
            <p style={{ fontSize: 14, color: T.textPrimary, fontWeight: 500 }}>
              Arraste imagens aqui ou clique para escolher
            </p>
            <Mono size={10} color={T.textMuted}>
              JPG · PNG · HEIC · WEBP · MÁX 25MB · ATÉ {MAX_UPLOAD_BATCH_SIZE} ARQUIVOS
            </Mono>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              multiple
              capture="environment"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </div>

          {/* Pending previews */}
          {pending.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
              {pending.map((p) => (
                <Glass key={p.id} style={{ padding: 0, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: 90,
                      backgroundImage: `url(${p.preview})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      position: 'relative',
                    }}
                  >
                    <button
                      type="button"
                      aria-label={`Remover ${p.file.name}`}
                      onClick={() => removeAt(p.id)}
                      disabled={submitting}
                      style={{
                        position: 'absolute', top: 6, right: 6,
                        width: 22, height: 22, borderRadius: '50%',
                        background: 'rgba(0,0,0,0.55)', border: 'none', color: '#fff',
                        cursor: submitting ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 0,
                      }}
                    >
                      <Ico name="x" size={12} color="#fff" />
                    </button>
                  </div>
                  <div style={{ padding: '6px 8px' }}>
                    <p style={{
                      fontSize: 11, color: T.textSecondary, lineHeight: 1.3,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {p.file.name}
                    </p>
                    <Mono size={9} color={T.textMuted}>
                      {(p.file.size / (1024 * 1024)).toFixed(1)} MB
                    </Mono>
                    {submitting && (
                      <div style={{ marginTop: 4, height: 3, background: T.divider, borderRadius: 2, overflow: 'hidden' }}>
                        <div
                          style={{ width: `${p.progress}%`, height: '100%', background: T.primary, transition: 'width 0.2s' }}
                          aria-label={`Progresso ${p.progress}%`}
                        />
                      </div>
                    )}
                  </div>
                </Glass>
              ))}
            </div>
          )}

          {/* Vínculo a lesão existente */}
          <Field
            label="Vincular a lesão existente"
            hint={lesions.length === 0 ? 'Sem lesões cadastradas — crie uma nova selecionando a região abaixo.' : undefined}
          >
            <select
              value={linkLesion}
              onChange={(e) => setLinkLesion(e.target.value)}
              disabled={submitting || !!lesionId}
              style={selectStyle()}
            >
              <option value="">— Criar nova lesão</option>
              {lesions.map((l) => (
                <option key={l.id} value={l.id}>
                  {regionLabel(l.bodyRegion)} · {l.description?.slice(0, 60) || 'Sem descrição'}
                </option>
              ))}
            </select>
            {linkedLesion && (
              <div style={{ marginTop: 6 }}>
                <Badge variant={linkedLesion.status === 'active' ? 'danger' : 'warning'} dot>
                  {linkedLesion.status === 'active' ? 'Ativa' : 'Monitoramento'}
                </Badge>
              </div>
            )}
          </Field>

          {/* Region & captureType */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field
              label={linkLesion ? 'Região (definida pela lesão)' : 'Região anatômica *'}
              hint={linkLesion ? regionLabel(linkedLesion?.bodyRegion ?? '') : undefined}
            >
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value as BodyRegion)}
                disabled={submitting || !!linkLesion}
                style={selectStyle()}
              >
                <option value="" disabled>Selecionar região</option>
                {BODY_REGIONS.map((r) => (
                  <option key={r} value={r}>{regionLabel(r)}</option>
                ))}
              </select>
            </Field>

            <Field label="Tipo de captura *">
              <select
                value={captureType}
                onChange={(e) => setCaptureType(e.target.value as CaptureType)}
                disabled={submitting}
                style={selectStyle()}
              >
                {CAPTURE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <Mono size={9} color={T.textMuted} style={{ marginTop: 4, display: 'block' }}>
                {CAPTURE_OPTIONS.find((o) => o.value === captureType)?.hint?.toUpperCase()}
              </Mono>
            </Field>
          </div>

          {!linkLesion && (
            <Field label="Descrição inicial da lesão" hint="Será usada na criação da nova lesão.">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={submitting}
                placeholder="Ex.: nevo melanocítico assimétrico, ~6mm, dorso superior."
                maxLength={2000}
                rows={2}
                style={textareaStyle()}
              />
            </Field>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
            <Field label="Equipamento" hint="Ex.: DermLite IV, smartphone.">
              <input
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
                disabled={submitting}
                maxLength={100}
                style={inputStyle()}
              />
            </Field>
            <Field label="Observações da captura">
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={submitting}
                maxLength={2000}
                placeholder="Iluminação, ângulo, contexto…"
                style={inputStyle()}
              />
            </Field>
          </div>

          {/* Consent */}
          <label
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: 12, borderRadius: T.r.md,
              border: `1px solid ${consent ? T.primaryBorder : T.divider}`,
              background: consent ? T.primaryBg : T.glass,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              disabled={submitting}
              style={{ marginTop: 2, accentColor: T.primary }}
            />
            <div>
              <p style={{ fontSize: 13, color: T.textPrimary, fontWeight: 500 }}>
                Consentimento do paciente confirmado
              </p>
              <Mono size={9} color={T.textMuted} style={{ marginTop: 2 }}>
                CONFIRMO QUE O PACIENTE CONSENTIU COM O REGISTRO FOTOGRÁFICO PARA FINS CLÍNICOS, CONFORME LGPD E TERMO DE USO INTERNO.
              </Mono>
            </div>
          </label>

          {/* Errors */}
          {globalError && (
            <div style={{
              padding: '10px 12px',
              borderRadius: T.r.md,
              background: T.dangerBg,
              border: `1px solid ${T.dangerBorder}`,
            }}>
              <Mono size={10} color={T.danger}>
                {globalError}
              </Mono>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer style={{
          padding: '12px 20px',
          borderTop: `1px solid ${T.divider}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
        }}>
          <Mono size={9} color={T.textMuted}>
            {pending.length === 0 ? 'AGUARDANDO ARQUIVOS' : `PRONTO PARA ENVIAR ${pending.length}`}
          </Mono>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" small onClick={onClose} disabled={submitting}>
              Cancelar
            </Btn>
            <Btn
              small
              icon="image"
              onClick={submit}
              disabled={submitting || pending.length === 0 || !consent}
              loading={submitting}
            >
              {submitting ? 'Enviando…' : `Enviar ${pending.length || ''}`.trim()}
            </Btn>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function Field({
  label, hint, children,
}: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Mono size={10} color={T.textMuted}>{label.toUpperCase()}</Mono>
      {children}
      {hint && (
        <Mono size={9} color={T.textMuted} style={{ marginTop: 2 }}>
          {hint}
        </Mono>
      )}
    </label>
  );
}

function selectStyle(): React.CSSProperties {
  return {
    padding: '8px 10px',
    fontSize: 13,
    color: T.textPrimary,
    background: '#fff',
    border: `1px solid ${T.divider}`,
    borderRadius: T.r.md,
    outline: 'none',
    fontFamily: 'inherit',
  };
}
function inputStyle(): React.CSSProperties {
  return {
    padding: '8px 10px',
    fontSize: 13,
    color: T.textPrimary,
    background: '#fff',
    border: `1px solid ${T.divider}`,
    borderRadius: T.r.md,
    outline: 'none',
    fontFamily: 'inherit',
  };
}
function textareaStyle(): React.CSSProperties {
  return {
    ...inputStyle(),
    resize: 'vertical',
    minHeight: 50,
    fontFamily: 'inherit',
  };
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
        let msg = `Erro ${xhr.status}`;
        try {
          const body = JSON.parse(xhr.responseText);
          if (body.message) msg = body.message;
        } catch { /* noop */ }
        reject(new Error(msg));
      }
    };
    xhr.onerror   = () => reject(new Error('Erro de rede durante o upload.'));
    xhr.ontimeout = () => reject(new Error('Tempo esgotado durante o upload.'));
    xhr.send(form);
  });
}
