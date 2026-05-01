'use client';

import * as React from 'react';
import {
  Btn,
  Field,
  Glass,
  Input,
  Mono,
  Select,
  T,
  Textarea,
} from '@dermaos/ui/ds';
import {
  PRESCRIPTION_TYPES,
  PRESCRIPTION_TYPE_LABELS,
  type PrescriptionItem,
  type PrescriptionType,
} from '@dermaos/shared';
import {
  MedicationItemEditor,
  createEmptyItem,
} from './medication-item-editor';
import { detectAllergyConflicts, type AllergyMatch } from './check-allergies';

/* ── Types ──────────────────────────────────────────────────────────────── */

export interface PrescriptionDraft {
  type:       PrescriptionType;
  items:      PrescriptionItem[];
  notes:      string;
  validUntil: string; // ISO yyyy-mm-dd or empty
}

export interface PrescriptionBuilderProps {
  value:      PrescriptionDraft;
  onChange:   (next: PrescriptionDraft) => void;
  /** Lista de alergias do paciente para alerta inline. */
  allergies:  readonly string[];
  /** Quando true (prescrição assinada), todo conteúdo fica read-only. */
  disabled?:  boolean;
  /** Slot de ações no header (ex.: Salvar/Emitir). */
  headerActions?: React.ReactNode;
  /**
   * Bloqueia mudança de tipo após o primeiro item ser preenchido — o backend
   * valida que todos os itens correspondem ao tipo da prescrição.
   */
  lockType?: boolean;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

export function emptyDraft(type: PrescriptionType = 'topica'): PrescriptionDraft {
  return {
    type,
    items: [createEmptyItem(type)],
    notes: '',
    validUntil: '',
  };
}

/* ── Component ──────────────────────────────────────────────────────────── */

export function PrescriptionBuilder({
  value,
  onChange,
  allergies,
  disabled,
  headerActions,
  lockType,
}: PrescriptionBuilderProps) {
  const matches: AllergyMatch[] = React.useMemo(
    () => detectAllergyConflicts(value.items, allergies),
    [value.items, allergies],
  );
  const matchedIndexes = React.useMemo(
    () => new Set(matches.map((m) => m.itemIndex)),
    [matches],
  );

  function setType(next: PrescriptionType) {
    if (next === value.type) return;
    onChange({
      ...value,
      type: next,
      // Recria itens conforme o novo tipo — o discriminated union do backend exige
      items: [createEmptyItem(next)],
    });
  }

  function updateItem(idx: number, next: PrescriptionItem) {
    onChange({
      ...value,
      items: value.items.map((it, i) => (i === idx ? next : it)),
    });
  }

  function addItem() {
    onChange({ ...value, items: [...value.items, createEmptyItem(value.type)] });
  }

  function duplicateItem(idx: number) {
    const src = value.items[idx];
    if (!src) return;
    const next: PrescriptionItem = JSON.parse(JSON.stringify(src));
    onChange({
      ...value,
      items: [...value.items.slice(0, idx + 1), next, ...value.items.slice(idx + 1)],
    });
  }

  function removeItem(idx: number) {
    if (value.items.length <= 1) return;
    onChange({ ...value, items: value.items.filter((_, i) => i !== idx) });
  }

  function moveItem(from: number, to: number) {
    if (to < 0 || to >= value.items.length) return;
    const items = [...value.items];
    const [moved] = items.splice(from, 1);
    if (moved) items.splice(to, 0, moved);
    onChange({ ...value, items });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header / metadata */}
      <Glass style={{ padding: 16 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <Mono size={11} spacing="1.1px" color={T.primary}>NOVA PRESCRIÇÃO</Mono>
          <div style={{ display: 'flex', gap: 8 }}>{headerActions}</div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 180px',
            gap: 12,
          }}
        >
          <Field label="Tipo" required>
            <Select
              value={value.type}
              disabled={disabled || lockType}
              onChange={(e) => setType(e.target.value as PrescriptionType)}
              aria-label="Tipo da prescrição"
            >
              {PRESCRIPTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PRESCRIPTION_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Validade (opcional)">
            <Input
              type="date"
              value={value.validUntil}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, validUntil: e.target.value })}
              aria-label="Validade"
            />
          </Field>
        </div>
      </Glass>

      {/* Allergy summary banner inside builder */}
      {allergies.length > 0 && (
        <div
          role="region"
          aria-label="Alergias do paciente"
          style={{
            padding: '10px 14px',
            borderRadius: T.r.md,
            background: matches.length ? T.dangerBg : '#FEF3CD',
            border: `1px solid ${matches.length ? T.dangerBorder : '#F0D97E'}`,
            color: matches.length ? T.danger : '#856404',
            fontSize: 13,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            fontFamily: "'IBM Plex Sans', sans-serif",
          }}
        >
          <strong style={{ fontSize: 12, letterSpacing: '0.4px' }}>
            ALERGIAS DO PACIENTE
          </strong>
          <span>{allergies.join(', ')}</span>
          {matches.length > 0 && (
            <span style={{ fontWeight: 600 }}>
              {matches.length === 1
                ? '1 item desta prescrição combina com uma alergia conhecida.'
                : `${matches.length} itens desta prescrição combinam com alergias conhecidas.`}
              {' '}Revise antes de emitir.
            </span>
          )}
        </div>
      )}

      {/* Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {value.items.map((item, i) => (
          <MedicationItemEditor
            key={i}
            index={i}
            total={value.items.length}
            type={value.type}
            value={item}
            disabled={disabled}
            hasAllergyMatch={matchedIndexes.has(i)}
            onChange={(next) => updateItem(i, next)}
            onRemove={() => removeItem(i)}
            onDuplicate={() => duplicateItem(i)}
            onMoveUp={() => moveItem(i, i - 1)}
            onMoveDown={() => moveItem(i, i + 1)}
          />
        ))}
      </div>

      {!disabled && (
        <Btn
          variant="glass"
          icon="plus"
          type="button"
          onClick={addItem}
          style={{ alignSelf: 'flex-start' }}
        >
          Adicionar item
        </Btn>
      )}

      {/* Notes */}
      <Glass style={{ padding: 16 }}>
        <Field label="Observações ao paciente (opcional)">
          <Textarea
            value={value.notes}
            disabled={disabled}
            placeholder="Orientações gerais, retorno, precauções, contraindicações…"
            rows={4}
            maxLength={4000}
            onChange={(e) => onChange({ ...value, notes: e.target.value })}
          />
        </Field>
      </Glass>
    </div>
  );
}
