'use client';

import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Button, Input, Textarea, Switch,
} from '@dermaos/ui';
import type { PrescriptionItem, PrescriptionType } from '@dermaos/shared';
import { PRESCRIPTION_TYPE_FIELDS } from '@dermaos/shared';

interface PrescriptionItemEditorProps {
  type:  PrescriptionType;
  item:  Partial<PrescriptionItem>;
  onChange: (next: Partial<PrescriptionItem>) => void;
  onRemove: () => void;
  index: number;
}

type DraftRecord = Record<string, unknown>;

export function PrescriptionItemEditor({
  type, item, onChange, onRemove, index,
}: PrescriptionItemEditorProps) {
  const fields = PRESCRIPTION_TYPE_FIELDS[type];
  const draft = item as DraftRecord;

  const update = (key: string, value: unknown) => {
    onChange({ ...(item as object), type, [key]: value } as Partial<PrescriptionItem>);
  };

  return (
    <div className="rounded-md border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Item {index + 1}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          aria-label={`Remover item ${index + 1}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {fields.map((field) => {
          const value = draft[field.key];

          if (field.kind === 'components') {
            const components = (value as { substance: string; concentration: string }[]) ?? [];
            return (
              <ComponentsEditor
                key={field.key}
                components={components}
                onChange={(next) => update(field.key, next)}
              />
            );
          }

          if (field.kind === 'switch') {
            return (
              <label key={field.key} className="flex items-center gap-2 text-sm">
                <Switch
                  checked={Boolean(value)}
                  onCheckedChange={(checked) => update(field.key, checked)}
                  aria-label={field.label}
                />
                <span>{field.label}</span>
              </label>
            );
          }

          if (field.kind === 'textarea') {
            return (
              <div key={field.key} className="md:col-span-2">
                <label className="text-xs text-muted-foreground block mb-1">
                  {field.label}{field.required && <span className="text-destructive"> *</span>}
                </label>
                <Textarea
                  value={(value as string) ?? ''}
                  maxLength={field.maxLength}
                  onChange={(e) => update(field.key, e.target.value)}
                  rows={2}
                />
              </div>
            );
          }

          if (field.kind === 'number') {
            return (
              <div key={field.key}>
                <label className="text-xs text-muted-foreground block mb-1">
                  {field.label}{field.required && <span className="text-destructive"> *</span>}
                </label>
                <Input
                  type="number"
                  min={field.min}
                  max={field.max}
                  value={value != null ? String(value) : ''}
                  onChange={(e) => {
                    const n = e.target.value === '' ? undefined : Number(e.target.value);
                    update(field.key, n);
                  }}
                />
              </div>
            );
          }

          return (
            <div key={field.key}>
              <label className="text-xs text-muted-foreground block mb-1">
                {field.label}{field.required && <span className="text-destructive"> *</span>}
              </label>
              <Input
                type="text"
                value={(value as string) ?? ''}
                maxLength={field.maxLength}
                placeholder={field.placeholder}
                onChange={(e) => update(field.key, e.target.value)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ComponentsEditor({
  components,
  onChange,
}: {
  components: { substance: string; concentration: string }[];
  onChange: (next: { substance: string; concentration: string }[]) => void;
}) {
  return (
    <div className="md:col-span-2 space-y-2">
      <label className="text-xs text-muted-foreground block">
        Componentes da fórmula <span className="text-destructive">*</span>
      </label>
      {components.map((c, i) => (
        <div key={i} className="flex gap-2">
          <Input
            placeholder="Substância"
            value={c.substance}
            onChange={(e) => {
              const next = [...components];
              next[i] = { ...c, substance: e.target.value };
              onChange(next);
            }}
          />
          <Input
            placeholder="Concentração"
            value={c.concentration}
            onChange={(e) => {
              const next = [...components];
              next[i] = { ...c, concentration: e.target.value };
              onChange(next);
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Remover componente ${i + 1}`}
            onClick={() => {
              const next = components.filter((_, idx) => idx !== i);
              onChange(next);
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...components, { substance: '', concentration: '' }])}
      >
        <Plus className="h-4 w-4" aria-hidden="true" /> Adicionar componente
      </Button>
    </div>
  );
}
