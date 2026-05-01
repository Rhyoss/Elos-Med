'use client';

import * as React from 'react';
import { Glass, Mono, T } from '@dermaos/ui/ds';
import {
  PRESCRIPTION_TYPE_LABELS,
  type PrescriptionItem,
  type PrescriptionType,
} from '@dermaos/shared';

/* ── Types ──────────────────────────────────────────────────────────────── */

export interface PrescriptionPreviewProps {
  clinicName?:        string | null;
  clinicLogoUrl?:     string | null;
  prescriberName:     string;
  prescriberCrm?:     string | null;
  prescriberSpecialty?: string | null;
  patientName:        string;
  patientBirthDate?:  Date | null;
  type:               PrescriptionType;
  items:              readonly PrescriptionItem[];
  notes?:             string | null;
  prescriptionNumber?: string | null;
  validUntil?:        Date | null;
  signedAt?:          Date | null;
  signatureHash?:     string | null;
  isDraft?:           boolean;
  isCancelled?:       boolean;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(d);
}

function ItemBlock({ index, item }: { index: number; item: PrescriptionItem }) {
  let title = '';
  const lines: string[] = [];

  switch (item.type) {
    case 'topica': {
      title = item.name || '—';
      if (item.concentration)  lines.push(`Concentração: ${item.concentration}`);
      if (item.applicationArea) lines.push(`Aplicar em: ${item.applicationArea}`);
      if (item.frequency)      lines.push(`Posologia: ${item.frequency}`);
      if (item.durationDays)   lines.push(`Duração: ${item.durationDays} dia(s)`);
      if (item.instructions)   lines.push(`Orientações: ${item.instructions}`);
      break;
    }
    case 'sistemica': {
      title = `${item.name || '—'} ${item.dosage || ''}`.trim();
      if (item.form)            lines.push(`Forma: ${item.form}`);
      if (item.route)           lines.push(`Via: ${item.route}`);
      if (item.frequency)       lines.push(`Posologia: ${item.frequency}`);
      if (item.durationDays)    lines.push(`Duração: ${item.durationDays} dia(s)${item.continuousUse ? ' (uso contínuo)' : ''}`);
      if (item.quantity)        lines.push(`Quantidade: ${item.quantity}`);
      if (item.instructions)    lines.push(`Orientações: ${item.instructions}`);
      break;
    }
    case 'manipulada': {
      title = item.formulation || '—';
      if (item.vehicle) lines.push(`Veículo: ${item.vehicle}`);
      if (item.components.length) {
        lines.push('Componentes:');
        for (const c of item.components) {
          if (c.substance || c.concentration) {
            lines.push(`  • ${c.substance || '—'} — ${c.concentration || '—'}`);
          }
        }
      }
      if (item.quantity)        lines.push(`Quantidade total: ${item.quantity}`);
      if (item.applicationArea) lines.push(`Aplicar em: ${item.applicationArea}`);
      if (item.frequency)       lines.push(`Posologia: ${item.frequency}`);
      if (item.durationDays)    lines.push(`Duração: ${item.durationDays} dia(s)`);
      if (item.instructions)    lines.push(`Orientações: ${item.instructions}`);
      break;
    }
    case 'cosmeceutica': {
      title = item.name || '—';
      if (item.brand)           lines.push(`Marca: ${item.brand}`);
      if (item.applicationArea) lines.push(`Aplicar em: ${item.applicationArea}`);
      if (item.frequency)       lines.push(`Frequência: ${item.frequency}`);
      if (item.instructions)    lines.push(`Orientações: ${item.instructions}`);
      break;
    }
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <p
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: '#000',
          margin: 0,
          fontFamily: 'Helvetica, Arial, sans-serif',
        }}
      >
        {index + 1}. {title}
      </p>
      <div style={{ marginTop: 4 }}>
        {lines.map((line, i) => (
          <p
            key={i}
            style={{
              fontSize: 13,
              color: '#222',
              margin: 0,
              lineHeight: 1.45,
              fontFamily: 'Helvetica, Arial, sans-serif',
              whiteSpace: 'pre-wrap',
            }}
          >
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

/* ── Component ──────────────────────────────────────────────────────────── */

export function PrescriptionPreview({
  clinicName,
  clinicLogoUrl,
  prescriberName,
  prescriberCrm,
  prescriberSpecialty,
  patientName,
  patientBirthDate,
  type,
  items,
  notes,
  prescriptionNumber,
  validUntil,
  signedAt,
  signatureHash,
  isDraft,
  isCancelled,
}: PrescriptionPreviewProps) {
  return (
    <Glass style={{ padding: 0, overflow: 'hidden' }}>
      {/* Watermark / status banner */}
      {(isDraft || isCancelled) && (
        <div
          aria-hidden
          style={{
            background: isCancelled ? T.dangerBg : '#FEF3CD',
            color: isCancelled ? T.danger : '#856404',
            border: `1px solid ${isCancelled ? T.dangerBorder : '#F0D97E'}`,
            padding: '6px 12px',
            fontSize: 11,
            fontFamily: "'IBM Plex Mono', monospace",
            letterSpacing: '0.6px',
            textTransform: 'uppercase',
            fontWeight: 600,
            textAlign: 'center',
          }}
        >
          {isCancelled
            ? 'Prescrição cancelada — pré-visualização apenas para auditoria'
            : 'Pré-visualização — esta prescrição ainda não foi assinada'}
        </div>
      )}

      <div
        style={{
          background: '#fff',
          padding: 28,
          minHeight: 720,
          color: '#000',
          fontFamily: 'Helvetica, Arial, sans-serif',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 12 }}>
          {clinicLogoUrl ? (
            // Sem next/image para não bloquear domínio: preview client-side
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={clinicLogoUrl}
              alt={clinicName ?? ''}
              style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 8 }}
            />
          ) : null}
          <div style={{ flex: 1 }}>
            <p
              style={{
                fontSize: 16,
                fontWeight: 700,
                margin: 0,
                textAlign: 'center',
                letterSpacing: '0.5px',
              }}
            >
              RECEITUÁRIO MÉDICO
            </p>
            {clinicName && (
              <p style={{ fontSize: 13, margin: 0, textAlign: 'center', color: '#444' }}>
                {clinicName}
              </p>
            )}
          </div>
        </div>

        <hr style={{ border: 0, borderTop: '1px solid #888', margin: '12px 0' }} />

        {/* Prescriber */}
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 13, margin: 0, fontWeight: 600 }}>{prescriberName}</p>
          <p style={{ fontSize: 12, margin: 0, color: '#444' }}>
            {[
              prescriberCrm ? `CRM: ${prescriberCrm}` : null,
              prescriberSpecialty,
            ].filter(Boolean).join(' · ') || '—'}
          </p>
          <p style={{ fontSize: 11, margin: '4px 0 0', color: '#666' }}>
            Prescrição {prescriptionNumber ?? '—'} · Emitida em {fmtDate(signedAt) }
          </p>
        </div>

        {/* Patient */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 700, margin: 0 }}>Paciente</p>
          <p style={{ fontSize: 13, margin: 0 }}>{patientName}</p>
          {patientBirthDate && (
            <p style={{ fontSize: 12, margin: 0, color: '#444' }}>
              Data de nascimento: {fmtDate(patientBirthDate)}
            </p>
          )}
        </div>

        {/* Type */}
        <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>
          Prescrição — {PRESCRIPTION_TYPE_LABELS[type] ?? type}
        </p>

        {/* Items */}
        {items.length === 0 ? (
          <p style={{ fontSize: 13, color: '#777', fontStyle: 'italic' }}>
            Adicione ao menos um item para pré-visualizar.
          </p>
        ) : (
          items.map((it, i) => <ItemBlock key={i} index={i} item={it} />)
        )}

        {/* Notes */}
        {notes && (
          <>
            <p style={{ fontSize: 13, fontWeight: 700, margin: '14px 0 4px' }}>Observações</p>
            <p style={{ fontSize: 13, color: '#222', whiteSpace: 'pre-wrap', margin: 0 }}>
              {notes}
            </p>
          </>
        )}

        {/* Validity */}
        {validUntil && (
          <p style={{ fontSize: 12, color: '#444', margin: '14px 0 0' }}>
            Válida até {fmtDate(validUntil)}.
          </p>
        )}

        {/* Signature */}
        <div style={{ marginTop: 36 }}>
          <hr style={{ border: 0, borderTop: '1px solid #000', width: 240, margin: '0 0 4px' }} />
          <p style={{ fontSize: 12, margin: 0 }}>{prescriberName}</p>
          {prescriberCrm && (
            <p style={{ fontSize: 12, margin: 0 }}>CRM: {prescriberCrm}</p>
          )}
          {signedAt ? (
            <p style={{ fontSize: 10, color: '#666', margin: '4px 0 0' }}>
              Assinado digitalmente em {fmtDate(signedAt)}
            </p>
          ) : (
            <p style={{ fontSize: 10, color: '#666', margin: '4px 0 0' }}>
              Aguardando assinatura digital
            </p>
          )}
          {signatureHash && (
            <Mono size={9} color="#777">
              Hash: {signatureHash.slice(0, 16)}…{signatureHash.slice(-8)}
            </Mono>
          )}
        </div>
      </div>
    </Glass>
  );
}
