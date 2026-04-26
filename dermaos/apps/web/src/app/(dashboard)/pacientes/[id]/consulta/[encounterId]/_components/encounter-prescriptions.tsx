'use client';

import * as React from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@dermaos/ui';

interface EncounterPrescriptionsProps {
  encounterId: string;
  patientId:   string;
  disabled?:   boolean;
}

/**
 * Sumário de prescrições ligadas ao encounter. O modal/sheet completo
 * de emissão de receita é entregue no Prompt 09.
 */
export function EncounterPrescriptions({ encounterId, patientId, disabled }: EncounterPrescriptionsProps) {
  return (
    <section aria-labelledby="prescriptions-heading" className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 id="prescriptions-heading" className="text-sm font-semibold text-foreground">
          Prescrição
        </h3>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          aria-label="Nova prescrição"
          data-encounter-id={encounterId}
          data-patient-id={patientId}
        >
          <FileText className="h-4 w-4" aria-hidden="true" />
          Nova Prescrição
        </Button>
      </div>
      <div className="flex min-h-16 items-center justify-center rounded-md border border-dashed border-border bg-muted/30 text-xs text-muted-foreground">
        Nenhuma prescrição emitida neste atendimento.
      </div>
    </section>
  );
}
