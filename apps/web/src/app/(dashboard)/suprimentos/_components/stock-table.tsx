'use client';

import * as React from 'react';
import { Btn, Mono, Skeleton, T } from '@dermaos/ui/ds';
import { StatusBadge } from './status-badge';
import type { StockStatus } from '@dermaos/shared';

export interface StockRow {
  id:               string;
  name:             string;
  sku:              string | null;
  unit:             string;
  category_name:    string | null;
  qty_total:        number;
  min_stock:        number;
  max_stock:        number | null;
  reorder_point:    number | null;
  next_expiry:      string | null;
  coverage_days:    number | null;
  statuses:         StockStatus[];
  is_controlled:    boolean;
  is_cold_chain:    boolean;
  /** Vem de StockPositionRow.supplier_name (preferred_supplier). Null se não cadastrado. */
  supplier_name?:   string | null;
  /** Custo unitário catalogado (não o custo do lote). */
  unit_cost?:       number | null;
  /** Quantidade de lotes ativos com saldo. */
  active_lots?:     number;
}

export interface StockTableProps {
  rows:       StockRow[];
  isLoading:  boolean;
  onRowClick: (row: StockRow) => void;
  onAdjust:   (row: StockRow) => void;
  onOrder:    (row: StockRow) => void;
}

function formatQty(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}

function formatBRL(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function ExpiryCell({ date }: { date: string | null }) {
  if (!date) return <Mono size={9}>—</Mono>;
  const d = new Date(date);
  const now = new Date();
  const days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const fmt = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const color = days < 30 ? T.danger : days < 60 ? T.warning : T.textPrimary;
  return (
    <Mono size={9} color={color} weight={days < 60 ? 600 : 500}>
      {fmt}
    </Mono>
  );
}

function CoverageCell({ days }: { days: number | null }) {
  if (days === null) return <Mono size={9}>N/D</Mono>;
  const color = days < 7 ? T.danger : days < 30 ? T.warning : T.textPrimary;
  return (
    <Mono size={10} color={color} weight={days < 30 ? 600 : 500}>
      {days}d
    </Mono>
  );
}

const HEAD_CELL: React.CSSProperties = {
  padding: '9px 14px',
  textAlign: 'left',
  fontSize: 8,
  fontFamily: "'IBM Plex Mono', monospace",
  letterSpacing: '1.1px',
  color: T.textMuted,
  fontWeight: 500,
  borderBottom: `1px solid ${T.divider}`,
  background: T.metalGrad,
  whiteSpace: 'nowrap',
};

const CELL: React.CSSProperties = {
  padding: '11px 14px',
  fontSize: 12,
  color: T.textPrimary,
};

export function StockTable({
  rows,
  isLoading,
  onRowClick,
  onAdjust,
  onOrder,
}: StockTableProps) {
  if (isLoading) {
    return (
      <div aria-label="Carregando posição de estoque" role="status" style={{ padding: 4 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              borderBottom: `1px solid ${T.divider}`,
              padding: '12px 14px',
            }}
          >
            <Skeleton width={80}  height={14} delay={i * 60} />
            <Skeleton width={'40%' as const} height={14} delay={i * 60 + 30} />
            <Skeleton width={70}  height={14} delay={i * 60 + 60} />
            <Skeleton width={50}  height={14} delay={i * 60 + 90} />
            <Skeleton width={70}  height={14} delay={i * 60 + 120} />
          </div>
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div
        role="status"
        style={{
          padding: '48px 16px',
          textAlign: 'center',
        }}
      >
        <Mono size={9} color={T.textMuted}>NENHUM PRODUTO ENCONTRADO</Mono>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1180 }}>
        <thead>
          <tr>
            <th style={HEAD_CELL}>Status</th>
            <th style={HEAD_CELL}>Produto</th>
            <th style={HEAD_CELL}>Categoria</th>
            <th style={{ ...HEAD_CELL, textAlign: 'right' }}>Lotes</th>
            <th style={HEAD_CELL}>Próx. Venc.</th>
            <th style={{ ...HEAD_CELL, textAlign: 'right' }}>Qtd</th>
            <th style={{ ...HEAD_CELL, textAlign: 'right' }}>Mín.</th>
            <th style={{ ...HEAD_CELL, textAlign: 'right' }}>Custo</th>
            <th style={HEAD_CELL}>Fornecedor</th>
            <th style={{ ...HEAD_CELL, textAlign: 'right' }}>Cob.</th>
            <th style={HEAD_CELL}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.id}
              onClick={() => onRowClick(row)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onRowClick(row);
                }
              }}
              tabIndex={0}
              style={{
                borderBottom: `1px solid ${T.divider}`,
                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.22)',
                cursor: 'pointer',
              }}
            >
              <td style={CELL}>
                <StatusBadge statuses={row.statuses} />
              </td>
              <td style={CELL}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: T.textPrimary,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 280,
                    }}
                  >
                    {row.name}
                  </span>
                  {row.is_controlled && (
                    <span
                      title="Controlado"
                      style={{
                        padding: '0 4px',
                        borderRadius: 3,
                        background: T.aiBg,
                        color: T.ai,
                        fontSize: 8,
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontWeight: 700,
                        letterSpacing: '0.5px',
                        flexShrink: 0,
                      }}
                    >
                      C
                    </span>
                  )}
                  {row.is_cold_chain && (
                    <span
                      title="Cadeia fria"
                      style={{
                        padding: '0 4px',
                        borderRadius: 3,
                        background: T.infoBg,
                        color: T.info,
                        fontSize: 8,
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontWeight: 700,
                        letterSpacing: '0.5px',
                        flexShrink: 0,
                      }}
                    >
                      ❄
                    </span>
                  )}
                </div>
                {row.sku && <Mono size={8}>{row.sku}</Mono>}
              </td>
              <td style={{ ...CELL, color: T.textSecondary, fontSize: 11 }}>
                {row.category_name ?? '—'}
              </td>
              <td style={{ ...CELL, textAlign: 'right' }}>
                <Mono size={10} color={T.textPrimary} weight={500}>
                  {row.active_lots ?? 0}
                </Mono>
              </td>
              <td style={CELL}>
                <ExpiryCell date={row.next_expiry} />
              </td>
              <td style={{ ...CELL, textAlign: 'right' }}>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: T.textPrimary }}>
                  {formatQty(row.qty_total)}
                </span>
                <Mono size={8} color={T.textMuted}> {row.unit}</Mono>
              </td>
              <td style={{ ...CELL, textAlign: 'right', fontSize: 11, color: T.textMuted }}>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatQty(row.min_stock)}
                </span>
              </td>
              <td style={{ ...CELL, textAlign: 'right' }}>
                <Mono size={10} color={T.textSecondary}>
                  {formatBRL(row.unit_cost)}
                </Mono>
              </td>
              <td style={{ ...CELL, color: T.textSecondary, fontSize: 11, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.supplier_name ?? '—'}
              </td>
              <td style={{ ...CELL, textAlign: 'right' }}>
                <CoverageCell days={row.coverage_days} />
              </td>
              <td style={CELL}>
                <div
                  style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Btn
                    variant="ghost"
                    small
                    iconOnly
                    icon="creditCard"
                    aria-label={`Pedido de ${row.name}`}
                    title="Pedir"
                    onClick={() => onOrder(row)}
                  />
                  <Btn
                    variant="ghost"
                    small
                    iconOnly
                    icon="edit"
                    aria-label={`Ajustar estoque de ${row.name}`}
                    title="Ajustar"
                    onClick={() => onAdjust(row)}
                  />
                  <Btn
                    variant="ghost"
                    small
                    iconOnly
                    icon="layers"
                    aria-label={`Ver lotes de ${row.name}`}
                    title="Lotes"
                    onClick={() => onRowClick(row)}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
