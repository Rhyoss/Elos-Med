'use client';

import * as React from 'react';
import type {
  PrescriptionItem,
  PrescriptionType,
} from '@dermaos/shared';
import { PRESCRIPTION_TYPE_LABELS } from '@dermaos/shared';

interface PrescriptionPreviewProps {
  type:  PrescriptionType;
  items: PrescriptionItem[];
  notes?: string;
  patientName?: string;
  prescriberName?: string;
  prescriberCrm?: string | null;
}

/**
 * Preview visual da prescrição (formato similar ao PDF).
 * É puramente apresentacional; debounce acontece no componente pai.
 */
export function PrescriptionPreview({
  type, items, notes, patientName, prescriberName, prescriberCrm,
}: PrescriptionPreviewProps) {
  return (
    <div
      className="bg-white rounded-md border border-border p-6 text-sm text-foreground overflow-auto max-h-[60vh]"
      aria-label="Pré-visualização da prescrição"
    >
      <div className="text-center mb-6">
        <h3 className="text-lg font-bold">RECEITUÁRIO MÉDICO</h3>
      </div>

      {prescriberName && (
        <div className="mb-4 text-sm">
          <p className="font-medium">{prescriberName}</p>
          {prescriberCrm && <p className="text-muted-foreground">CRM: {prescriberCrm}</p>}
        </div>
      )}

      <hr className="my-3 border-border" />

      {patientName && (
        <div className="mb-4">
          <p className="font-semibold">Paciente</p>
          <p>{patientName}</p>
        </div>
      )}

      <p className="font-semibold mb-2">
        Prescrição — {PRESCRIPTION_TYPE_LABELS[type]}
      </p>

      <ol className="list-decimal pl-6 space-y-3">
        {items.map((item, idx) => (
          <li key={idx}>
            <PrescriptionItemRender item={item} />
          </li>
        ))}
      </ol>

      {notes && (
        <div className="mt-6">
          <p className="font-semibold">Observações</p>
          <p className="whitespace-pre-wrap">{notes}</p>
        </div>
      )}
    </div>
  );
}

function PrescriptionItemRender({ item }: { item: PrescriptionItem }) {
  switch (item.type) {
    case 'topica':
      return (
        <div>
          <p className="font-medium">
            {item.name}{item.concentration ? ` ${item.concentration}` : ''}
          </p>
          <p>Aplicar em: {item.applicationArea}</p>
          <p>Posologia: {item.frequency}</p>
          {item.durationDays && <p>Duração: {item.durationDays} dia(s)</p>}
          {item.instructions && <p>Orientações: {item.instructions}</p>}
        </div>
      );
    case 'sistemica':
      return (
        <div>
          <p className="font-medium">{item.name} {item.dosage}</p>
          {item.form && <p>Forma: {item.form}</p>}
          {item.route && <p>Via: {item.route}</p>}
          <p>Posologia: {item.frequency}</p>
          <p>Duração: {item.durationDays} dia(s){item.continuousUse ? ' (uso contínuo)' : ''}</p>
          {item.quantity && <p>Quantidade: {item.quantity}</p>}
          {item.instructions && <p>Orientações: {item.instructions}</p>}
        </div>
      );
    case 'manipulada':
      return (
        <div>
          <p className="font-medium">{item.formulation}</p>
          <p>Veículo: {item.vehicle}</p>
          <p className="font-medium mt-1">Componentes:</p>
          <ul className="list-disc pl-6">
            {item.components.map((c, i) => (
              <li key={i}>{c.substance} — {c.concentration}</li>
            ))}
          </ul>
          <p>Quantidade total: {item.quantity}</p>
          <p>Aplicar em: {item.applicationArea}</p>
          <p>Posologia: {item.frequency}</p>
          {item.durationDays && <p>Duração: {item.durationDays} dia(s)</p>}
          {item.instructions && <p>Orientações: {item.instructions}</p>}
        </div>
      );
    case 'cosmeceutica':
      return (
        <div>
          <p className="font-medium">{item.name}</p>
          {item.brand && <p>Marca: {item.brand}</p>}
          <p>Aplicar em: {item.applicationArea}</p>
          <p>Frequência: {item.frequency}</p>
          {item.instructions && <p>Orientações: {item.instructions}</p>}
        </div>
      );
  }
}
