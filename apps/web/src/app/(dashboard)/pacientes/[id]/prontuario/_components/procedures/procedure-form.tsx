'use client';

import * as React from 'react';
import { Badge, Btn, Glass, Ico, Mono, T } from '@dermaos/ui/ds';
import { LabeledInput } from './labeled-input';
import { AnatomicalRegionSelector, type AnatomicalRegionId, ANATOMICAL_REGIONS } from './anatomical-region-selector';
import { ProductLotPicker, type SelectedProduct } from './product-lot-picker';

/* ── Types ─────────────────────────────────────────────────────────────── */

export const PROCEDURE_TYPES = [
  { id: 'botox', label: 'Toxina botulínica', icon: 'zap' as const },
  { id: 'preenchimento', label: 'Preenchimento', icon: 'activity' as const },
  { id: 'laser', label: 'Laser', icon: 'star' as const },
  { id: 'peeling', label: 'Peeling', icon: 'layers' as const },
  { id: 'biopsia', label: 'Biópsia', icon: 'edit' as const },
  { id: 'fototerapia', label: 'Fototerapia', icon: 'star' as const },
  { id: 'microagulhamento', label: 'Microagulhamento', icon: 'grid' as const },
  { id: 'outro', label: 'Outro / Template', icon: 'file' as const },
] as const;

export type ProcedureTypeId = (typeof PROCEDURE_TYPES)[number]['id'];

export interface ProcedurePhoto {
  id: string;
  url?: string;
  name: string;
  phase: 'before' | 'after';
}

export interface ProcedureFormData {
  type: ProcedureTypeId;
  customName?: string;
  regions: AnatomicalRegionId[];
  products: SelectedProduct[];
  consentAttached: boolean;
  consentNotes?: string;
  photosBefore: ProcedurePhoto[];
  photosAfter: ProcedurePhoto[];
  orientations: string;
  returnDays?: number;
  returnNotes?: string;
  observations: string;
  durationMin?: number;
  scheduleReturn?: boolean;
}

interface ProcedureFormProps {
  patientId: string;
  patientName: string;
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ProcedureFormData) => void;
  isSubmitting?: boolean;
}

/* ── Steps ─────────────────────────────────────────────────────────────── */

const STEPS = [
  { id: 'type', label: 'Tipo' },
  { id: 'region', label: 'Região' },
  { id: 'products', label: 'Produtos' },
  { id: 'photos', label: 'Fotos' },
  { id: 'details', label: 'Detalhes' },
  { id: 'review', label: 'Revisão' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

/* ── Component ─────────────────────────────────────────────────────────── */

export function ProcedureForm({
  patientId,
  patientName,
  open,
  onClose,
  onSubmit,
  isSubmitting,
}: ProcedureFormProps) {
  const [step, setStep] = React.useState<StepId>('type');
  const defaultData: ProcedureFormData = {
    type: 'botox',
    regions: [],
    products: [],
    consentAttached: false,
    photosBefore: [],
    photosAfter: [],
    orientations: '',
    observations: '',
  };
  const [data, setData] = React.useState<ProcedureFormData>(defaultData);

  React.useEffect(() => {
    if (open) {
      setStep('type');
      setData({ ...defaultData });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const stepIdx = STEPS.findIndex((s) => s.id === step);
  const hasExpiredLot = data.products.some(
    (p) => p.expiryDate && new Date(p.expiryDate) < new Date(),
  );

  function canProceed(): boolean {
    switch (step) {
      case 'type': return true;
      case 'region': return data.regions.length > 0;
      case 'products': return !hasExpiredLot;
      case 'photos': return true;
      case 'details': return true;
      case 'review': return !hasExpiredLot;
      default: return false;
    }
  }

  function handleNext() {
    const next = STEPS[stepIdx + 1];
    if (next) setStep(next.id);
  }

  function handleBack() {
    const prev = STEPS[stepIdx - 1];
    if (prev) setStep(prev.id);
  }

  function handleSubmit() {
    if (hasExpiredLot) return;
    onSubmit(data);
  }

  const patch = (p: Partial<ProcedureFormData>) => setData((d) => ({ ...d, ...p }));

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(6px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: '100%', maxWidth: 680, maxHeight: '90vh',
          background: '#fff', borderRadius: T.r.xl,
          boxShadow: T.shadow.xl, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: `1px solid ${T.divider}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <p style={{ fontSize: 17, fontWeight: 700, color: T.textPrimary }}>
              Registrar Procedimento
            </p>
            <Mono size={10} color={T.textMuted}>
              {patientName} · ID {patientId.slice(0, 8).toUpperCase()}
            </Mono>
          </div>
          <button
            type="button" onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <Ico name="x" size={20} color={T.textMuted} />
          </button>
        </div>

        {/* Step indicator */}
        <div style={{
          display: 'flex', gap: 2, padding: '12px 20px',
          borderBottom: `1px solid ${T.divider}`, background: '#FAFAFA',
        }}>
          {STEPS.map((s, i) => (
            <div key={s.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{
                height: 3, borderRadius: 2,
                background: i <= stepIdx ? T.primary : T.glassBorder,
                transition: 'background 0.2s',
              }} />
              <Mono
                size={9}
                spacing="0.5px"
                color={i <= stepIdx ? T.primary : T.textMuted}
                style={{ textAlign: 'center' }}
              >
                {s.label}
              </Mono>
            </div>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {step === 'type' && (
            <StepType value={data.type} customName={data.customName} onChange={patch} />
          )}
          {step === 'region' && (
            <StepRegion value={data.regions} onChange={(regions) => patch({ regions })} />
          )}
          {step === 'products' && (
            <StepProducts value={data.products} onChange={(products) => patch({ products })} />
          )}
          {step === 'photos' && (
            <StepPhotos
              photosBefore={data.photosBefore}
              photosAfter={data.photosAfter}
              onChange={patch}
            />
          )}
          {step === 'details' && (
            <StepDetails data={data} onChange={patch} />
          )}
          {step === 'review' && (
            <StepReview data={data} hasExpiredLot={hasExpiredLot} />
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: `1px solid ${T.divider}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            {stepIdx > 0 && (
              <Btn variant="ghost" small icon="arrowLeft" onClick={handleBack}>
                Voltar
              </Btn>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" small onClick={onClose}>Cancelar</Btn>
            {step === 'review' ? (
              <Btn
                small
                icon="check"
                onClick={handleSubmit}
                disabled={!canProceed() || isSubmitting}
              >
                {isSubmitting ? 'Registrando…' : 'Finalizar Registro'}
              </Btn>
            ) : (
              <Btn small icon="arrowRight" onClick={handleNext} disabled={!canProceed()}>
                Próximo
              </Btn>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Step: Type ─────────────────────────────────────────────────────────── */

function StepType({
  value,
  customName,
  onChange,
}: {
  value: ProcedureTypeId;
  customName?: string;
  onChange: (p: Partial<ProcedureFormData>) => void;
}) {
  return (
    <div>
      <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary, marginBottom: 14 }}>
        Tipo de procedimento
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        {PROCEDURE_TYPES.map((pt) => {
          const selected = value === pt.id;
          return (
            <button
              key={pt.id}
              type="button"
              onClick={() => onChange({ type: pt.id })}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 16px', borderRadius: T.r.lg,
                border: `1.5px solid ${selected ? T.clinical.color : T.glassBorder}`,
                background: selected ? T.clinical.bg : 'rgba(255,255,255,0.5)',
                cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: T.r.md,
                background: selected ? 'rgba(23,77,56,0.12)' : T.glass,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Ico name={pt.icon} size={17} color={selected ? T.clinical.color : T.textMuted} />
              </div>
              <p style={{
                fontSize: 14, fontWeight: selected ? 600 : 400,
                color: selected ? T.clinical.color : T.textPrimary,
              }}>
                {pt.label}
              </p>
            </button>
          );
        })}
      </div>

      {value === 'outro' && (
        <div style={{ marginTop: 14 }}>
          <LabeledInput
            label="Nome do procedimento"
            value={customName ?? ''}
            onChange={(e) => onChange({ customName: e.target.value })}
            placeholder="Descreva o tipo de procedimento…"
          />
        </div>
      )}
    </div>
  );
}

/* ── Step: Region ──────────────────────────────────────────────────────── */

function StepRegion({
  value,
  onChange,
}: {
  value: AnatomicalRegionId[];
  onChange: (regions: AnatomicalRegionId[]) => void;
}) {
  return (
    <div>
      <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary, marginBottom: 4 }}>
        Região anatômica
      </p>
      <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 14 }}>
        Selecione uma ou mais regiões onde o procedimento será realizado.
      </p>
      <AnatomicalRegionSelector value={value} onChange={onChange} />
    </div>
  );
}

/* ── Step: Products ────────────────────────────────────────────────────── */

function StepProducts({
  value,
  onChange,
}: {
  value: SelectedProduct[];
  onChange: (products: SelectedProduct[]) => void;
}) {
  return (
    <div>
      <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary, marginBottom: 4 }}>
        Produtos e lotes
      </p>
      <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 14 }}>
        Adicione os produtos utilizados. O sistema sugere lotes por FEFO (primeiro a vencer).
      </p>
      <ProductLotPicker value={value} onChange={onChange} />
      {value.length === 0 && (
        <div style={{
          marginTop: 12, padding: '10px 14px', borderRadius: T.r.md,
          background: T.infoBg, border: `1px solid ${T.infoBorder}`,
        }}>
          <p style={{ fontSize: 12, color: T.info }}>
            Produtos são opcionais. Você pode prosseguir sem adicioná-los.
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Step: Details ─────────────────────────────────────────────────────── */

function StepDetails({
  data,
  onChange,
}: {
  data: ProcedureFormData;
  onChange: (p: Partial<ProcedureFormData>) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Consent */}
      <Glass style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Ico name="file" size={16} color={T.primary} />
            <p style={{ fontSize: 14, fontWeight: 500, color: T.textPrimary }}>
              Termo de consentimento
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange({ consentAttached: !data.consentAttached })}
            style={{
              width: 40, height: 22, borderRadius: 11,
              background: data.consentAttached ? T.primary : T.glassBorder,
              border: 'none', cursor: 'pointer', position: 'relative',
              transition: 'background 0.2s',
            }}
          >
            <div style={{
              width: 18, height: 18, borderRadius: '50%',
              background: '#fff', position: 'absolute', top: 2,
              left: data.consentAttached ? 20 : 2,
              transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
            }} />
          </button>
        </div>
        {data.consentAttached && (
          <div style={{ marginTop: 10 }}>
            <LabeledInput
              label="Observações do termo"
              value={data.consentNotes ?? ''}
              onChange={(e) => onChange({ consentNotes: e.target.value })}
              placeholder="Informações adicionais sobre o consentimento…"
            />
            {/* TODO: integrar upload real do termo quando endpoint disponível */}
          </div>
        )}
      </Glass>

      {/* Orientations */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, marginBottom: 6, display: 'block' }}>
          Orientações pós-procedimento
        </label>
        <textarea
          value={data.orientations}
          onChange={(e) => onChange({ orientations: e.target.value })}
          placeholder="Ex: Evitar exposição solar por 7 dias, aplicar protetor FPS 50…"
          rows={3}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: T.r.md,
            border: `1px solid ${T.inputBorder}`, background: T.inputBg,
            fontSize: 14, fontFamily: "'IBM Plex Sans', sans-serif",
            resize: 'vertical', color: T.textPrimary,
          }}
        />
      </div>

      {/* Return */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <LabeledInput
            label="Retorno recomendado (dias)"
            type="number"
            value={data.returnDays != null ? String(data.returnDays) : ''}
            onChange={(e) => {
              const v = e.target.value ? Number(e.target.value) : undefined;
              onChange({ returnDays: v });
            }}
            placeholder="Ex: 15"
            min={1}
            max={365}
          />
        </div>
        <div style={{ flex: 2 }}>
          <LabeledInput
            label="Observação do retorno"
            value={data.returnNotes ?? ''}
            onChange={(e) => onChange({ returnNotes: e.target.value })}
            placeholder="Ex: Avaliação do resultado…"
          />
        </div>
      </div>

      {data.returnDays && data.returnDays > 0 && (
        <Glass style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Ico name="calendar" size={16} color={T.primary} />
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, color: T.textPrimary }}>
                  Agendar retorno automaticamente
                </p>
                <p style={{ fontSize: 12, color: T.textMuted }}>
                  Cria agendamento para {data.returnDays} dias ({new Date(Date.now() + data.returnDays * 86400000).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })})
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onChange({ scheduleReturn: !data.scheduleReturn })}
              style={{
                width: 40, height: 22, borderRadius: 11,
                background: data.scheduleReturn ? T.primary : T.glassBorder,
                border: 'none', cursor: 'pointer', position: 'relative',
                transition: 'background 0.2s',
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                background: '#fff', position: 'absolute', top: 2,
                left: data.scheduleReturn ? 20 : 2,
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              }} />
            </button>
          </div>
        </Glass>
      )}

      {/* Duration */}
      <LabeledInput
        label="Duração do procedimento (min)"
        type="number"
        value={data.durationMin != null ? String(data.durationMin) : ''}
        onChange={(e) => {
          const v = e.target.value ? Number(e.target.value) : undefined;
          onChange({ durationMin: v });
        }}
        placeholder="Ex: 45"
        min={1}
        max={600}
      />

      {/* Observations */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, marginBottom: 6, display: 'block' }}>
          Observações gerais
        </label>
        <textarea
          value={data.observations}
          onChange={(e) => onChange({ observations: e.target.value })}
          placeholder="Anotações sobre o procedimento…"
          rows={3}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: T.r.md,
            border: `1px solid ${T.inputBorder}`, background: T.inputBg,
            fontSize: 14, fontFamily: "'IBM Plex Sans', sans-serif",
            resize: 'vertical', color: T.textPrimary,
          }}
        />
      </div>
    </div>
  );
}

/* ── Step: Review ──────────────────────────────────────────────────────── */

function StepReview({
  data,
  hasExpiredLot,
}: {
  data: ProcedureFormData;
  hasExpiredLot: boolean;
}) {
  const typeLabel = PROCEDURE_TYPES.find((t) => t.id === data.type)?.label ?? data.type;
  const regionLabels = data.regions
    .map((r) => ANATOMICAL_REGIONS.find((a) => a.id === r)?.label ?? r)
    .join(', ');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary }}>
        Revisão do procedimento
      </p>

      {hasExpiredLot && (
        <div style={{
          padding: '10px 14px', borderRadius: T.r.md,
          background: T.dangerBg, border: `1px solid ${T.dangerBorder}`,
          display: 'flex', gap: 8, alignItems: 'center',
        }}>
          <Ico name="alert" size={16} color={T.danger} />
          <p style={{ fontSize: 13, color: T.danger, fontWeight: 500 }}>
            Há lotes vencidos selecionados. Corrija antes de finalizar.
          </p>
        </div>
      )}

      <ReviewRow label="Tipo" value={data.customName || typeLabel} />
      <ReviewRow label="Regiões" value={regionLabels || '—'} />
      <ReviewRow label="Produtos" value={data.products.length > 0 ? `${data.products.length} produto(s)` : 'Nenhum'} />

      {data.products.length > 0 && (
        <div style={{ paddingLeft: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {data.products.map((p) => (
            <div key={p.productId} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Ico name="box" size={12} color={T.supply.color} />
              <Mono size={10} color={T.textSecondary}>
                {p.productName} — {p.quantity} {p.unit}
                {p.lotNumber && ` · Lote ${p.lotNumber}`}
              </Mono>
            </div>
          ))}
        </div>
      )}

      <ReviewRow label="Fotos (antes)" value={data.photosBefore.length > 0 ? `${data.photosBefore.length} foto(s)` : 'Nenhuma'} />
      <ReviewRow label="Fotos (depois)" value={data.photosAfter.length > 0 ? `${data.photosAfter.length} foto(s)` : 'Nenhuma'} />
      <ReviewRow label="Consentimento" value={data.consentAttached ? 'Anexado' : 'Não anexado'} />
      <ReviewRow label="Orientações" value={data.orientations || '—'} />
      <ReviewRow label="Retorno" value={data.returnDays ? `${data.returnDays} dias${data.scheduleReturn ? ' (agendar)' : ''}` : 'Não definido'} />
      {data.durationMin && <ReviewRow label="Duração" value={`${data.durationMin} min`} />}
      {data.observations && <ReviewRow label="Observações" value={data.observations} />}
    </div>
  );
}

/* ── Step: Photos ─────────────────────────────────────────────────────── */

function StepPhotos({
  photosBefore,
  photosAfter,
  onChange,
}: {
  photosBefore: ProcedurePhoto[];
  photosAfter: ProcedurePhoto[];
  onChange: (p: Partial<ProcedureFormData>) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary, marginBottom: 0 }}>
        Fotos clínicas
      </p>
      <p style={{ fontSize: 13, color: T.textMuted }}>
        Registre fotos antes e depois do procedimento para acompanhamento clínico.
      </p>

      <PhotoSection
        label="ANTES DO PROCEDIMENTO"
        icon="image"
        photos={photosBefore}
        onAdd={() => {
          const photo: ProcedurePhoto = {
            id: crypto.randomUUID(),
            name: `Foto antes ${photosBefore.length + 1}`,
            phase: 'before',
          };
          onChange({ photosBefore: [...photosBefore, photo] });
        }}
        onRemove={(id) => onChange({ photosBefore: photosBefore.filter((p) => p.id !== id) })}
      />

      <PhotoSection
        label="DEPOIS DO PROCEDIMENTO"
        icon="image"
        photos={photosAfter}
        onAdd={() => {
          const photo: ProcedurePhoto = {
            id: crypto.randomUUID(),
            name: `Foto depois ${photosAfter.length + 1}`,
            phase: 'after',
          };
          onChange({ photosAfter: [...photosAfter, photo] });
        }}
        onRemove={(id) => onChange({ photosAfter: photosAfter.filter((p) => p.id !== id) })}
      />

      {/* TODO: integrar upload real de fotos quando endpoint de imagens clínicas estiver disponível */}
      <div style={{
        padding: '10px 14px', borderRadius: T.r.md,
        background: T.infoBg, border: `1px solid ${T.infoBorder}`,
        display: 'flex', gap: 8, alignItems: 'center',
      }}>
        <Ico name="alert" size={14} color={T.info} />
        <p style={{ fontSize: 12, color: T.info }}>
          O upload de fotos registra referências. Imagens completas podem ser adicionadas pela aba Imagens do prontuário.
        </p>
      </div>
    </div>
  );
}

function PhotoSection({
  label,
  icon,
  photos,
  onAdd,
  onRemove,
}: {
  label: string;
  icon: string;
  photos: ProcedurePhoto[];
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <Glass style={{ padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: photos.length > 0 ? 10 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Ico name={icon as 'image'} size={16} color={T.clinical.color} />
          <Mono size={10} spacing="1px" color={T.textMuted}>{label}</Mono>
        </div>
        <Btn variant="ghost" small icon="plus" onClick={onAdd} disabled={photos.length >= 10}>
          Adicionar
        </Btn>
      </div>
      {photos.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {photos.map((photo) => (
            <div
              key={photo.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 10px', borderRadius: T.r.md,
                background: T.clinical.bg, border: `1px solid ${T.clinical.border}`,
              }}
            >
              <Ico name="image" size={12} color={T.clinical.color} />
              <span style={{ fontSize: 12, color: T.clinical.color }}>{photo.name}</span>
              <button
                type="button"
                onClick={() => onRemove(photo.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
              >
                <Ico name="x" size={12} color={T.textMuted} />
              </button>
            </div>
          ))}
        </div>
      )}
      {photos.length === 0 && (
        <p style={{ fontSize: 12, color: T.textMuted, textAlign: 'center', padding: '8px 0' }}>
          Nenhuma foto adicionada
        </p>
      )}
    </Glass>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', gap: 12, padding: '8px 12px',
      borderRadius: T.r.md, background: T.glass,
      border: `1px solid ${T.glassBorder}`,
    }}>
      <Mono size={9} spacing="0.5px" color={T.textMuted} style={{ width: 100, flexShrink: 0, paddingTop: 2 }}>
        {label.toUpperCase()}
      </Mono>
      <p style={{ fontSize: 13, color: T.textPrimary, lineHeight: 1.5 }}>{value}</p>
    </div>
  );
}
