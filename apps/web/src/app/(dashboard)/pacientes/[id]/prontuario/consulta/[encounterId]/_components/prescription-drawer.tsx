'use client';

import * as React from 'react';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import {
  SheetRoot,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Button,
  Input,
  Select,
  SelectItem,
  useToast,
} from '@dermaos/ui';
import { Mono, T } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import type {
  CreatePrescriptionInput,
  PrescriptionType,
} from '@dermaos/shared';

/* ── Types ─────────────────────────────────────────────────────────── */

interface PrescriptionItem {
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

const EMPTY_ITEM: PrescriptionItem = {
  medication: '',
  dosage: '',
  frequency: '',
  duration: '',
  instructions: '',
};

const TYPE_LABELS: Record<PrescriptionType, string> = {
  topica: 'Tópica',
  sistemica: 'Sistêmica',
  manipulada: 'Manipulada',
  cosmeceutica: 'Cosmecêutica',
};

/* ── Component ─────────────────────────────────────────────────────── */

interface PrescriptionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  encounterId: string;
  allergies: string[];
}

export function PrescriptionDrawer({
  open,
  onOpenChange,
  patientId,
  encounterId,
  allergies,
}: PrescriptionDrawerProps) {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [type, setType] = React.useState<PrescriptionType>('topica');
  const [items, setItems] = React.useState<PrescriptionItem[]>([{ ...EMPTY_ITEM }]);
  const [notes, setNotes] = React.useState('');

  const createMut = trpc.clinical.prescriptions.create.useMutation({
    onSuccess: () => {
      void utils.clinical.prescriptions.listByPatient.invalidate({ patientId });
      void utils.clinical.encounters.getByPatient.invalidate({ patientId });
      toast.success('Prescrição criada');
      resetForm();
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error('Erro ao criar prescrição', {
        description: err.message,
      });
    },
  });

  function resetForm() {
    setType('topica');
    setItems([{ ...EMPTY_ITEM }]);
    setNotes('');
  }

  function updateItem(index: number, field: keyof PrescriptionItem, value: string) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  }

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItem(index: number) {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const allergyWarnings = React.useMemo(() => {
    if (!allergies.length) return [];
    const warnings: string[] = [];
    for (const item of items) {
      if (!item.medication.trim()) continue;
      const med = item.medication.toLowerCase();
      for (const allergy of allergies) {
        if (med.includes(allergy.toLowerCase()) || allergy.toLowerCase().includes(med)) {
          warnings.push(`"${item.medication}" pode conflitar com alergia "${allergy}"`);
        }
      }
    }
    return warnings;
  }, [items, allergies]);

  function handleSubmit() {
    const validItems = items.filter((item) => item.medication.trim());
    if (validItems.length === 0) {
      toast.warning('Adicione ao menos um medicamento');
      return;
    }

    const prescriptionItems = validItems.map((item) => {
      switch (type) {
        case 'topica':
          return {
            type: 'topica' as const,
            name: item.medication,
            concentration: item.dosage || undefined,
            applicationArea: item.instructions || 'Conforme orientação',
            frequency: item.frequency || '1x ao dia',
            durationDays: parseInt(item.duration) || undefined,
            instructions: item.instructions || undefined,
          };
        case 'sistemica':
          return {
            type: 'sistemica' as const,
            name: item.medication,
            dosage: item.dosage || '1 comprimido',
            frequency: item.frequency || '1x ao dia',
            durationDays: parseInt(item.duration) || 30,
            continuousUse: false,
            instructions: item.instructions || undefined,
          };
        case 'manipulada':
          return {
            type: 'manipulada' as const,
            formulation: item.medication,
            vehicle: 'creme',
            components: [{ substance: item.medication, concentration: item.dosage || '1%' }],
            quantity: item.duration || '30g',
            applicationArea: item.instructions || 'Conforme orientação',
            frequency: item.frequency || '1x ao dia',
            instructions: item.instructions || undefined,
          };
        case 'cosmeceutica':
          return {
            type: 'cosmeceutica' as const,
            name: item.medication,
            applicationArea: item.instructions || 'Conforme orientação',
            frequency: item.frequency || '1x ao dia',
            instructions: item.instructions || undefined,
          };
      }
    });

    createMut.mutate({
      patientId,
      encounterId,
      type,
      items: prescriptionItems,
      notes: notes || undefined,
    } as CreatePrescriptionInput);
  }

  return (
    <SheetRoot open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" style={{ width: 480, maxWidth: '90vw' }}>
        <SheetHeader>
          <SheetTitle>Nova Prescrição</SheetTitle>
          <SheetDescription>
            Vincular ao atendimento atual
          </SheetDescription>
        </SheetHeader>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Allergy warnings */}
          {allergies.length > 0 && (
            <div
              role="alert"
              style={{
                padding: '8px 12px',
                borderRadius: T.r.md,
                background: T.dangerBg,
                border: `1px solid ${T.dangerBorder}`,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <AlertTriangle style={{ width: 16, height: 16, color: T.danger, flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: T.danger, margin: 0 }}>
                  Alergias registradas
                </p>
                <p style={{ fontSize: 11, color: T.danger, margin: '2px 0 0', opacity: 0.85 }}>
                  {allergies.join(', ')}
                </p>
              </div>
            </div>
          )}

          {/* Conflict warnings */}
          {allergyWarnings.length > 0 && (
            <div
              role="alert"
              style={{
                padding: '8px 12px',
                borderRadius: T.r.md,
                background: '#FEF3CD',
                border: '1px solid #F0D97E',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <AlertTriangle style={{ width: 16, height: 16, color: '#856404', flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#856404', margin: 0 }}>
                  Possível conflito com alergia
                </p>
                {allergyWarnings.map((w) => (
                  <p key={w} style={{ fontSize: 11, color: '#856404', margin: '2px 0 0' }}>{w}</p>
                ))}
              </div>
            </div>
          )}

          {/* Type */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Mono size={9} spacing="0.6px">TIPO DA PRESCRIÇÃO</Mono>
            <Select
              value={type}
              onValueChange={(v) => setType(v as PrescriptionType)}
            >
              {(Object.entries(TYPE_LABELS) as [PrescriptionType, string][]).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </Select>
          </label>

          {/* Items */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Mono size={9} spacing="0.6px">MEDICAMENTOS</Mono>
              <Button size="sm" variant="outline" onClick={addItem}>
                <Plus style={{ width: 14, height: 14 }} />
                Adicionar
              </Button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {items.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '12px',
                    borderRadius: T.r.md,
                    border: `1px solid ${T.glassBorder}`,
                    background: T.glass,
                    position: 'relative',
                  }}
                >
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      aria-label="Remover medicamento"
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 4,
                      }}
                    >
                      <Trash2 style={{ width: 14, height: 14, color: T.textMuted }} />
                    </button>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingRight: items.length > 1 ? 28 : 0 }}>
                    <Input
                      value={item.medication}
                      onChange={(e) => updateItem(idx, 'medication', e.target.value)}
                      placeholder="Nome do medicamento"
                      aria-label="Medicamento"
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <Input
                        value={item.dosage}
                        onChange={(e) => updateItem(idx, 'dosage', e.target.value)}
                        placeholder="Concentração / dose"
                        aria-label="Dosagem"
                      />
                      <Input
                        value={item.frequency}
                        onChange={(e) => updateItem(idx, 'frequency', e.target.value)}
                        placeholder="Frequência (ex: 12/12h)"
                        aria-label="Frequência"
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <Input
                        value={item.duration}
                        onChange={(e) => updateItem(idx, 'duration', e.target.value)}
                        placeholder="Duração (ex: 30 dias)"
                        aria-label="Duração"
                      />
                      <Input
                        value={item.instructions}
                        onChange={(e) => updateItem(idx, 'instructions', e.target.value)}
                        placeholder="Instruções"
                        aria-label="Instruções"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Mono size={9} spacing="0.6px">OBSERVAÇÕES (OPCIONAL)</Mono>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instruções adicionais ao paciente…"
              rows={3}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: T.r.md,
                border: `1px solid ${T.glassBorder}`,
                background: T.glass,
                fontSize: 13,
                fontFamily: "'IBM Plex Sans', sans-serif",
                color: T.textPrimary,
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </label>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: `1px solid ${T.divider}`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={createMut.isPending}
            disabled={allergyWarnings.length > 0 && !confirm('Há possíveis conflitos com alergias. Deseja continuar?')}
          >
            Criar prescrição
          </Button>
        </div>
      </SheetContent>
    </SheetRoot>
  );
}
