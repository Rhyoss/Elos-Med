'use client';

import * as React from 'react';
import { Camera } from 'lucide-react';
import { Button } from '@dermaos/ui';

interface EncounterImagesProps {
  encounterId: string;
  patientId:   string;
  disabled?:   boolean;
}

/**
 * Grid de imagens da consulta. Upload real (MinIO + clinical.lesion_images)
 * é entregue no Prompt 10 (módulo de imagens dermatológicas). Aqui mantemos
 * a área clicável, o contrato de IDs e o placeholder acessível.
 */
export function EncounterImages({ encounterId, patientId, disabled }: EncounterImagesProps) {
  return (
    <section aria-labelledby="encounter-images-heading" className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 id="encounter-images-heading" className="text-sm font-semibold text-foreground">
          Imagens desta consulta
        </h3>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          aria-label="Adicionar imagem à consulta"
          data-encounter-id={encounterId}
          data-patient-id={patientId}
        >
          <Camera className="h-4 w-4" aria-hidden="true" />
          Adicionar Imagem
        </Button>
      </div>
      <div className="flex min-h-24 items-center justify-center rounded-md border border-dashed border-border bg-muted/30 text-xs text-muted-foreground">
        Nenhuma imagem adicionada nesta consulta.
      </div>
    </section>
  );
}
