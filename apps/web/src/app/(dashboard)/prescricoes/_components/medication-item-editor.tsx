'use client';

import * as React from 'react';
import {
  Btn,
  Field,
  Glass,
  Ico,
  Input,
  Mono,
  Select,
  T,
  Textarea,
  Toggle,
} from '@dermaos/ui/ds';
import {
  PRESCRIPTION_TYPE_FIELDS,
  type PrescriptionItem,
  type PrescriptionType,
  type PrescriptionTypeField,
  type ManipuladaItem,
} from '@dermaos/shared';

/* ── Types ──────────────────────────────────────────────────────────────── */

export interface MedicationItemEditorProps {
  index:    number;
  total:    number;
  type:     PrescriptionType;
  value:    PrescriptionItem;
  onChange: (next: PrescriptionItem) => void;
  onRemove?:    () => void;
  onDuplicate?: () => void;
  onMoveUp?:    () => void;
  onMoveDown?:  () => void;
  disabled?:    boolean;
  /** Itens que conflitam com alergias destacam o card. */
  hasAllergyMatch?: boolean;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function fieldValue(item: PrescriptionItem, key: string): unknown {
  return (item as unknown as Record<string, unknown>)[key];
}

function setFieldValue(
  item: PrescriptionItem,
  key:  string,
  value: unknown,
): PrescriptionItem {
  return { ...item, [key]: value } as PrescriptionItem;
}

/** Render condicional para os componentes de uma fórmula manipulada. */
function ManipuladaComponents({
  value,
  onChange,
  disabled,
}: {
  value:    ManipuladaItem;
  onChange: (next: ManipuladaItem) => void;
  disabled?: boolean;
}) {
  function update(idx: number, key: 'substance' | 'concentration', v: string) {
    const next = value.components.map((c, i) => (i === idx ? { ...c, [key]: v } : c));
    onChange({ ...value, components: next });
  }
  function add() {
    onChange({ ...value, components: [...value.components, { substance: '', concentration: '' }] });
  }
  function remove(idx: number) {
    if (value.components.length <= 1) return;
    onChange({ ...value, components: value.components.filter((_, i) => i !== idx) });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Mono size={10} spacing="0.8px">COMPONENTES *</Mono>
        <Btn
          variant="ghost"
          small
          icon="plus"
          type="button"
          onClick={add}
          disabled={disabled}
        >
          Adicionar
        </Btn>
      </div>
      {value.components.map((c, i) => (
        <div
          key={i}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 140px 28px',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <Input
            value={c.substance}
            placeholder="Substância (ex: Tretinoína)"
            disabled={disabled}
            onChange={(e) => update(i, 'substance', e.target.value)}
            aria-label={`Substância ${i + 1}`}
          />
          <Input
            value={c.concentration}
            placeholder="Concentração (ex: 0,05%)"
            disabled={disabled}
            onChange={(e) => update(i, 'concentration', e.target.value)}
            aria-label={`Concentração ${i + 1}`}
          />
          <button
            type="button"
            disabled={disabled || value.components.length <= 1}
            onClick={() => remove(i)}
            aria-label="Remover componente"
            style={{
              width: 28,
              height: 28,
              border: `1px solid ${T.glassBorder}`,
              background: T.glass,
              borderRadius: T.r.sm,
              cursor: disabled || value.components.length <= 1 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: value.components.length <= 1 ? 0.4 : 1,
            }}
          >
            <Ico name="x" size={13} color={T.textMuted} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ── Main editor ────────────────────────────────────────────────────────── */

export function MedicationItemEditor({
  index,
  total,
  type,
  value,
  onChange,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  disabled,
  hasAllergyMatch,
}: MedicationItemEditorProps) {
  const fields = PRESCRIPTION_TYPE_FIELDS[type];

  return (
    <Glass
      style={{
        padding: 16,
        borderColor: hasAllergyMatch ? T.danger : undefined,
        boxShadow: hasAllergyMatch
          ? `0 0 0 1px ${T.danger}, 0 4px 14px rgba(154,32,32,0.10)`
          : undefined,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Mono size={11} spacing="1.1px" color={T.primary}>
            ITEM {String(index + 1).padStart(2, '0')}
          </Mono>
          {hasAllergyMatch && (
            <span
              role="img"
              aria-label="Possível conflito com alergia"
              title="Possível conflito com alergia"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                borderRadius: 999,
                background: T.dangerBg,
                border: `1px solid ${T.dangerBorder}`,
                color: T.danger,
                fontSize: 11,
                fontWeight: 600,
                fontFamily: "'IBM Plex Sans', sans-serif",
              }}
            >
              <Ico name="alert" size={11} color={T.danger} />
              alergia
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {onMoveUp && (
            <Btn
              variant="ghost"
              small
              iconOnly
              icon="arrowLeft"
              type="button"
              onClick={onMoveUp}
              disabled={disabled || index === 0}
              aria-label="Mover item para cima"
              style={{ transform: 'rotate(90deg)' }}
            />
          )}
          {onMoveDown && (
            <Btn
              variant="ghost"
              small
              iconOnly
              icon="arrowRight"
              type="button"
              onClick={onMoveDown}
              disabled={disabled || index === total - 1}
              aria-label="Mover item para baixo"
              style={{ transform: 'rotate(90deg)' }}
            />
          )}
          {onDuplicate && (
            <Btn
              variant="ghost"
              small
              iconOnly
              icon="copy"
              type="button"
              onClick={onDuplicate}
              disabled={disabled}
              aria-label="Duplicar item"
            />
          )}
          {onRemove && (
            <Btn
              variant="ghost"
              small
              iconOnly
              icon="x"
              type="button"
              onClick={onRemove}
              disabled={disabled || total <= 1}
              aria-label="Remover item"
            />
          )}
        </div>
      </div>

      {/* Fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {fields.map((field) => renderField(field, value, onChange, disabled))}
      </div>
    </Glass>
  );
}

function renderField(
  field: PrescriptionTypeField,
  item:  PrescriptionItem,
  onChange: (next: PrescriptionItem) => void,
  disabled?: boolean,
): React.ReactNode {
  const v = fieldValue(item, field.key);

  if (field.kind === 'components' && item.type === 'manipulada') {
    return (
      <div key={field.key}>
        <ManipuladaComponents
          value={item}
          onChange={(next) => onChange(next)}
          disabled={disabled}
        />
      </div>
    );
  }

  if (field.kind === 'switch') {
    return (
      <div
        key={field.key}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 0',
        }}
      >
        <label style={{ fontSize: 13, color: T.textSecondary, fontFamily: "'IBM Plex Sans', sans-serif" }}>
          {field.label}
        </label>
        <Toggle
          checked={Boolean(v)}
          disabled={disabled}
          onChange={(next) => onChange(setFieldValue(item, field.key, next))}
          label={field.label}
        />
      </div>
    );
  }

  if (field.kind === 'textarea') {
    return (
      <Field key={field.key} label={field.label} required={field.required}>
        <Textarea
          value={(v as string | undefined) ?? ''}
          maxLength={field.maxLength}
          rows={3}
          disabled={disabled}
          placeholder={field.placeholder ?? 'Orientações detalhadas para o paciente…'}
          onChange={(e) => onChange(setFieldValue(item, field.key, e.target.value))}
        />
      </Field>
    );
  }

  if (field.kind === 'number') {
    return (
      <Field key={field.key} label={field.label} required={field.required}>
        <Input
          type="number"
          value={typeof v === 'number' ? v : ''}
          min={field.min}
          max={field.max}
          disabled={disabled}
          onChange={(e) => {
            const raw = e.target.value;
            const next = raw === '' ? undefined : Number(raw);
            onChange(setFieldValue(item, field.key, next));
          }}
        />
      </Field>
    );
  }

  if (field.kind === 'select' && field.options) {
    return (
      <Field key={field.key} label={field.label} required={field.required}>
        <Select
          value={(v as string | undefined) ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(setFieldValue(item, field.key, e.target.value))}
        >
          <option value="" disabled>Selecione…</option>
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>
      </Field>
    );
  }

  // Default: text
  return (
    <Field key={field.key} label={field.label} required={field.required}>
      <Input
        value={(v as string | undefined) ?? ''}
        maxLength={field.maxLength}
        disabled={disabled}
        placeholder={field.placeholder}
        onChange={(e) => onChange(setFieldValue(item, field.key, e.target.value))}
      />
    </Field>
  );
}

/* ── Item factory for default values per type ───────────────────────────── */

export function createEmptyItem(type: PrescriptionType): PrescriptionItem {
  switch (type) {
    case 'topica':
      return { type: 'topica', name: '', applicationArea: '', frequency: '' };
    case 'sistemica':
      return {
        type: 'sistemica',
        name: '',
        dosage: '',
        frequency: '',
        durationDays: 30,
        continuousUse: false,
      };
    case 'manipulada':
      return {
        type: 'manipulada',
        formulation: '',
        vehicle: '',
        components: [{ substance: '', concentration: '' }],
        quantity: '',
        applicationArea: '',
        frequency: '',
      };
    case 'cosmeceutica':
      return { type: 'cosmeceutica', name: '', applicationArea: '', frequency: '' };
  }
}

