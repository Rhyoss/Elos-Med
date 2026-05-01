'use client';

import * as React from 'react';
import { Badge, Btn, Glass, Ico, Mono, Skeleton, T } from '@dermaos/ui/ds';
import {
  PRESCRIPTION_STATUS_LABELS,
  PRESCRIPTION_TYPE_LABELS,
  type PrescriptionStatus,
  type PrescriptionType,
} from '@dermaos/shared';
import {
  PRESCRIPTION_STATUS_VARIANT,
  usePrescriptionsByPatient,
} from '@/lib/hooks/use-prescriptions';

/* ── Types ──────────────────────────────────────────────────────────────── */

interface HistoryItem {
  id: string;
  prescriptionNumber: string | null;
  type:    PrescriptionType;
  status:  PrescriptionStatus;
  itemCount: number;
  createdAt: Date;
  signedAt:  Date | null;
}

interface PrescriptionHistoryPanelProps {
  patientId:        string;
  selectedId?:      string;
  onSelect?:        (id: string) => void;
  onDuplicate?:     (id: string) => void;
  /**
   * Quando true, oculta o card "Modelos / Favoritos" (não há backend ainda).
   * Em pacientes/atendimentos novos esse card explica a ausência de templates.
   */
  hideTemplates?:   boolean;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function fmtRelativeOrDate(d: Date): string {
  const now = Date.now();
  const diff = now - d.getTime();
  const day = 1000 * 60 * 60 * 24;
  if (diff < day) return 'hoje';
  if (diff < day * 2) return 'ontem';
  if (diff < day * 7) return `há ${Math.floor(diff / day)}d`;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(d);
}

/* ── Component ──────────────────────────────────────────────────────────── */

export function PrescriptionHistoryPanel({
  patientId,
  selectedId,
  onSelect,
  onDuplicate,
  hideTemplates,
}: PrescriptionHistoryPanelProps) {
  const listQ = usePrescriptionsByPatient(patientId, { pageSize: 30 });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      {/* Templates section — placeholder até backend expor favoritos/modelos */}
      {!hideTemplates && (
        <Glass style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Mono size={11} spacing="1px" color={T.primary}>MODELOS &amp; FAVORITOS</Mono>
            <Badge variant="default" dot={false}>
              em breve
            </Badge>
          </div>
          <p
            style={{
              marginTop: 8,
              fontSize: 13,
              color: T.textSecondary,
              lineHeight: 1.45,
            }}
          >
            Salvar prescrições como modelo reutilizável estará disponível na próxima entrega.
            Por enquanto, use <strong style={{ color: T.textPrimary }}>Duplicar</strong> a partir
            do histórico para reaproveitar uma receita anterior.
          </p>
        </Glass>
      )}

      {/* History */}
      <Glass style={{ padding: 14, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <Mono size={11} spacing="1px" color={T.primary}>HISTÓRICO</Mono>
          {listQ.data?.total != null && (
            <Mono size={10} color={T.textMuted}>
              {listQ.data.total} {listQ.data.total === 1 ? 'PRESCRIÇÃO' : 'PRESCRIÇÕES'}
            </Mono>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            overflowY: 'auto',
            paddingRight: 2,
          }}
        >
          {listQ.isLoading ? (
            <>
              <Skeleton height={68} />
              <Skeleton height={68} delay={80} />
              <Skeleton height={68} delay={160} />
            </>
          ) : (listQ.data?.data ?? []).length === 0 ? (
            <div
              style={{
                padding: '20px 8px',
                textAlign: 'center',
                color: T.textMuted,
                fontSize: 13,
              }}
            >
              Nenhuma prescrição emitida ainda.
            </div>
          ) : (
            (listQ.data!.data as HistoryItem[]).map((rx) => {
              const active = rx.id === selectedId;
              return (
                <button
                  key={rx.id}
                  type="button"
                  onClick={() => onSelect?.(rx.id)}
                  style={{
                    textAlign: 'left',
                    background: active ? T.primaryBg : 'transparent',
                    border: `1px solid ${active ? T.primaryBorder : T.glassBorder}`,
                    borderRadius: T.r.md,
                    padding: 10,
                    cursor: onSelect ? 'pointer' : 'default',
                    transition: 'background 0.15s',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>
                      {rx.prescriptionNumber ?? rx.id.slice(0, 8).toUpperCase()}
                    </span>
                    <Badge variant={PRESCRIPTION_STATUS_VARIANT[rx.status] ?? 'default'} dot={false}>
                      {PRESCRIPTION_STATUS_LABELS[rx.status] ?? rx.status}
                    </Badge>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Mono size={10}>
                      {fmtRelativeOrDate(rx.signedAt ?? rx.createdAt)}
                      {' · '}
                      {PRESCRIPTION_TYPE_LABELS[rx.type] ?? rx.type}
                      {' · '}
                      {rx.itemCount} {rx.itemCount === 1 ? 'item' : 'itens'}
                    </Mono>
                    {onDuplicate && (
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label="Duplicar prescrição"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicate(rx.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            onDuplicate(rx.id);
                          }
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '2px 6px',
                          borderRadius: T.r.sm,
                          color: T.textSecondary,
                          fontSize: 11,
                          cursor: 'pointer',
                        }}
                      >
                        <Ico name="copy" size={11} color={T.textSecondary} />
                        duplicar
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {listQ.data && listQ.data.total > listQ.data.data.length && (
          <div style={{ marginTop: 8, textAlign: 'center' }}>
            <Btn variant="ghost" small disabled>
              Mostrando {listQ.data.data.length} de {listQ.data.total}
            </Btn>
          </div>
        )}
      </Glass>
    </div>
  );
}
