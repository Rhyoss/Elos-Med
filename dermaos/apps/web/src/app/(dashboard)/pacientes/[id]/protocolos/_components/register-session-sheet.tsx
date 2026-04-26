'use client';

import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Button,
  SheetRoot,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
  SheetFooter,
  Input,
  Textarea,
  useToast,
} from '@dermaos/ui';
import type { AdverseEvent, AdverseSeverity } from '@dermaos/shared';
import { ADVERSE_SEVERITY_LABELS } from '@dermaos/shared';
import { trpc } from '@/lib/trpc-provider';

interface RegisterSessionSheetProps {
  protocolId:   string | null;
  patientId:    string;
  open:         boolean;
  onOpenChange: (open: boolean) => void;
}

export function RegisterSessionSheet({
  protocolId, patientId, open, onOpenChange,
}: RegisterSessionSheetProps) {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [observations, setObservations] = React.useState('');
  const [patientResponse, setPatientResponse] = React.useState('');
  const [durationMin, setDurationMin] = React.useState<number | undefined>(undefined);
  const [adverseEvents, setAdverseEvents] = React.useState<AdverseEvent[]>([]);
  const [outcome, setOutcome] = React.useState('');

  const registerMut = trpc.clinical.protocols.registerSession.useMutation({
    onSuccess: (data) => {
      toast({
        title: 'Sessão registrada',
        description: data.session.flagMedicalReview
          ? 'Marcada para revisão médica por evento grave.'
          : undefined,
      });
      void utils.clinical.protocols.listByPatient.invalidate({ patientId });
      void utils.clinical.protocols.listSessions.invalidate({ protocolId: protocolId ?? '' });
      reset();
      onOpenChange(false);
    },
    onError: (err) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  function reset() {
    setObservations('');
    setPatientResponse('');
    setDurationMin(undefined);
    setAdverseEvents([]);
    setOutcome('');
  }

  function handleSave() {
    if (!protocolId) return;
    registerMut.mutate({
      protocolId,
      durationMin,
      observations: observations || undefined,
      patientResponse: patientResponse || undefined,
      adverseEvents,
      productsConsumed: [],
      preImageIds: [],
      postImageIds: [],
      outcome: outcome || undefined,
    });
  }

  const hasGrave = adverseEvents.some((e) => e.severity === 'grave');

  return (
    <SheetRoot open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-[520px]">
        <SheetHeader>
          <SheetTitle>Registrar sessão</SheetTitle>
        </SheetHeader>

        <SheetBody className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Duração (min)</label>
            <Input
              type="number"
              min={1}
              max={600}
              value={durationMin != null ? String(durationMin) : ''}
              onChange={(e) => setDurationMin(e.target.value === '' ? undefined : Number(e.target.value))}
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">Observações</label>
            <Textarea
              rows={2}
              maxLength={2000}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">Resposta do paciente</label>
            <Textarea
              rows={2}
              maxLength={2000}
              value={patientResponse}
              onChange={(e) => setPatientResponse(e.target.value)}
            />
          </div>

          <AdverseEventsEditor events={adverseEvents} onChange={setAdverseEvents} />

          <div>
            <label className="text-xs text-muted-foreground block mb-1">Desfecho / evolução</label>
            <Textarea
              rows={2}
              maxLength={1000}
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
            />
          </div>

          {hasGrave && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              Evento grave registrado — a sessão será automaticamente marcada para revisão médica.
            </div>
          )}
        </SheetBody>

        <SheetFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!protocolId || registerMut.isPending}>
            {registerMut.isPending ? 'Registrando…' : 'Registrar sessão'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </SheetRoot>
  );
}

function AdverseEventsEditor({
  events, onChange,
}: {
  events: AdverseEvent[];
  onChange: (next: AdverseEvent[]) => void;
}) {
  function addOne() {
    onChange([...events, { description: '', severity: 'leve' as Exclude<AdverseSeverity, 'none'> }]);
  }
  return (
    <div className="space-y-2">
      <label className="text-xs text-muted-foreground block">Eventos adversos</label>
      {events.map((e, i) => (
        <div key={i} className="rounded-md border border-border p-2 space-y-2">
          <Input
            placeholder="Descrição"
            value={e.description}
            onChange={(ev) => {
              const next = [...events];
              next[i] = { ...e, description: ev.target.value };
              onChange(next);
            }}
          />
          <div className="flex gap-2">
            <select
              value={e.severity}
              onChange={(ev) => {
                const next = [...events];
                next[i] = { ...e, severity: ev.target.value as Exclude<AdverseSeverity, 'none'> };
                onChange(next);
              }}
              className="text-sm rounded-md border border-border px-2 py-1 bg-card"
            >
              {(['leve', 'moderado', 'grave'] as const).map((s) => (
                <option key={s} value={s}>{ADVERSE_SEVERITY_LABELS[s]}</option>
              ))}
            </select>
            <Input
              placeholder="Conduta adotada (opcional)"
              value={e.action ?? ''}
              onChange={(ev) => {
                const next = [...events];
                next[i] = { ...e, action: ev.target.value };
                onChange(next);
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Remover evento ${i + 1}`}
              onClick={() => onChange(events.filter((_, idx) => idx !== i))}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addOne}>
        <Plus className="h-4 w-4" aria-hidden="true" /> Adicionar evento adverso
      </Button>
    </div>
  );
}
