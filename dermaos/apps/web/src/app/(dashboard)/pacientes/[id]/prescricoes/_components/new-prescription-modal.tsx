'use client';

import * as React from 'react';
import { AlertCircle, Plus } from 'lucide-react';
import {
  Button,
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Textarea,
  useToast,
} from '@dermaos/ui';
import {
  PRESCRIPTION_TYPES,
  PRESCRIPTION_TYPE_LABELS,
  type PrescriptionType,
  type PrescriptionItem,
} from '@dermaos/shared';
import { trpc } from '@/lib/trpc-provider';
import { cn } from '@/lib/utils';
import { PrescriptionItemEditor } from './prescription-item-editor';
import { PrescriptionPreview } from './prescription-preview';

type Step = 'type' | 'items' | 'notes' | 'preview' | 'sign';

const STEP_LABELS: Record<Step, string> = {
  type:    '1. Tipo',
  items:   '2. Itens',
  notes:   '3. Observações',
  preview: '4. Pré-visualização',
  sign:    '5. Assinar',
};

const STEP_ORDER: Step[] = ['type', 'items', 'notes', 'preview', 'sign'];

interface NewPrescriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName?: string;
}

export function NewPrescriptionModal({
  open, onOpenChange, patientId, patientName,
}: NewPrescriptionModalProps) {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [step, setStep]   = React.useState<Step>('type');
  const [type, setType]   = React.useState<PrescriptionType | null>(null);
  const [items, setItems] = React.useState<Partial<PrescriptionItem>[]>([]);
  const [notes, setNotes] = React.useState('');
  const [prescriptionId, setPrescriptionId] = React.useState<string | null>(null);
  const [confirmSign, setConfirmSign] = React.useState(false);

  // ── Debounce para preview (300ms) ────────────────────────────────────
  const [debouncedItems, setDebouncedItems] = React.useState<Partial<PrescriptionItem>[]>([]);
  const [debouncedNotes, setDebouncedNotes] = React.useState('');
  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedItems(items);
      setDebouncedNotes(notes);
    }, 300);
    return () => clearTimeout(t);
  }, [items, notes]);

  const createMut = trpc.clinical.prescriptions.create.useMutation({
    onSuccess: (data) => {
      setPrescriptionId(data.prescription.id);
      setStep('sign');
    },
    onError:   (err) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  const signMut = trpc.clinical.prescriptions.sign.useMutation({
    onSuccess: () => {
      toast({ title: 'Prescrição assinada', description: 'PDF disponível para download.' });
      void utils.clinical.prescriptions.listByPatient.invalidate({ patientId });
      reset();
      onOpenChange(false);
    },
    onError:   (err) => toast({ title: 'Erro ao assinar', description: err.message, variant: 'destructive' }),
  });

  function reset() {
    setStep('type');
    setType(null);
    setItems([]);
    setNotes('');
    setPrescriptionId(null);
    setConfirmSign(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function addItem() {
    if (!type) return;
    const base: Partial<PrescriptionItem> = { type };
    if (type === 'manipulada') {
      (base as { components: { substance: string; concentration: string }[] }).components = [
        { substance: '', concentration: '' },
      ];
    }
    setItems((prev) => [...prev, base]);
  }

  function canAdvance(): boolean {
    if (step === 'type')    return type != null;
    if (step === 'items')   return items.length > 0;
    if (step === 'notes')   return true;
    if (step === 'preview') return true;
    return false;
  }

  function next() {
    const idx = STEP_ORDER.indexOf(step);
    if (idx < STEP_ORDER.length - 1) setStep(STEP_ORDER[idx + 1]!);
  }
  function prev() {
    const idx = STEP_ORDER.indexOf(step);
    if (idx > 0) setStep(STEP_ORDER[idx - 1]!);
  }

  async function handleCreateDraft() {
    if (!type) return;
    try {
      await createMut.mutateAsync({
        patientId,
        type,
        items: items as PrescriptionItem[],
        notes: notes || undefined,
      });
    } catch {
      // handled by onError
    }
  }

  return (
    <DialogRoot open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Nova prescrição</DialogTitle>
          <DialogDescription>
            {patientName ? `Paciente: ${patientName}` : null}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6">
          <StepperIndicator step={step} />
        </div>

        <div className="px-6 py-4 space-y-4">
          {step === 'type' && (
            <div>
              <p className="text-sm font-medium mb-3">Selecione o tipo da prescrição</p>
              <div className="grid grid-cols-2 gap-3">
                {PRESCRIPTION_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setType(t); setItems([{ type: t, ...(t === 'manipulada' ? { components: [{ substance: '', concentration: '' }] } : {}) }]); }}
                    className={cn(
                      'rounded-md border p-4 text-left transition-colors',
                      type === t
                        ? 'border-primary-600 bg-primary-50'
                        : 'border-border hover:border-primary-300',
                    )}
                    aria-pressed={type === t}
                  >
                    <span className="font-medium">{PRESCRIPTION_TYPE_LABELS[t]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'items' && type && (
            <div className="space-y-3">
              {items.map((item, idx) => (
                <PrescriptionItemEditor
                  key={idx}
                  type={type}
                  item={item}
                  index={idx}
                  onChange={(next) => setItems((prev) => prev.map((p, i) => (i === idx ? next : p)))}
                  onRemove={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                />
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4" aria-hidden="true" /> Adicionar item
              </Button>
            </div>
          )}

          {step === 'notes' && (
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                Observações gerais
              </label>
              <Textarea
                rows={5}
                maxLength={4000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Instruções ao paciente, uso combinado, etc."
              />
            </div>
          )}

          {step === 'preview' && type && (
            <PrescriptionPreview
              type={type}
              items={debouncedItems as PrescriptionItem[]}
              notes={debouncedNotes || undefined}
              patientName={patientName}
            />
          )}

          {step === 'sign' && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-4 flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" aria-hidden="true" />
              <div className="space-y-2 text-sm">
                <p className="font-medium text-amber-900">
                  Após assinatura, esta prescrição não poderá ser editada.
                </p>
                <p className="text-amber-800">
                  Um número oficial será gerado, um PDF com seu hash de assinatura será emitido e
                  esta versão ficará imutável no prontuário do paciente.
                </p>
                <label className="flex items-center gap-2 mt-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmSign}
                    onChange={(e) => setConfirmSign(e.target.checked)}
                  />
                  <span>Li e confirmo a assinatura digital desta prescrição.</span>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2 px-6 pb-6 pt-2 border-t">
          <Button
            type="button"
            variant="ghost"
            onClick={prev}
            disabled={step === 'type' || createMut.isPending || signMut.isPending}
          >
            Voltar
          </Button>

          {step !== 'preview' && step !== 'sign' && (
            <Button type="button" onClick={next} disabled={!canAdvance()}>
              Próximo
            </Button>
          )}

          {step === 'preview' && (
            <Button
              type="button"
              onClick={handleCreateDraft}
              disabled={createMut.isPending || items.length === 0}
            >
              {createMut.isPending ? 'Salvando…' : 'Confirmar dados'}
            </Button>
          )}

          {step === 'sign' && (
            <Button
              type="button"
              disabled={!confirmSign || !prescriptionId || signMut.isPending}
              onClick={() => prescriptionId && signMut.mutate({ id: prescriptionId })}
            >
              {signMut.isPending ? 'Assinando…' : 'Assinar prescrição'}
            </Button>
          )}
        </div>
      </DialogContent>
    </DialogRoot>
  );
}

function StepperIndicator({ step }: { step: Step }) {
  const activeIdx = STEP_ORDER.indexOf(step);
  return (
    <ol className="flex items-center gap-2 text-xs text-muted-foreground" aria-label="Progresso">
      {STEP_ORDER.map((s, i) => (
        <li
          key={s}
          className={cn(
            'px-2 py-1 rounded-md border',
            i === activeIdx
              ? 'border-primary-600 text-primary-700 font-medium bg-primary-50'
              : i < activeIdx
                ? 'border-border text-foreground'
                : 'border-border text-muted-foreground',
          )}
          aria-current={i === activeIdx ? 'step' : undefined}
        >
          {STEP_LABELS[s]}
        </li>
      ))}
    </ol>
  );
}
