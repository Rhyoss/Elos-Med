'use client';
import * as React from 'react';
import { T } from '../../tokens';
import { Mono } from './Mono';

export interface DataTableColumn<Row> {
  /** Header label (rendered uppercased in the metal-grad header). */
  header: string;
  /** Cell renderer. */
  cell: (row: Row, index: number) => React.ReactNode;
  /** Cell horizontal alignment. */
  align?: 'left' | 'center' | 'right';
  /** Fixed column width (CSS value). */
  width?: number | string;
  /** Optional className appended to <td>. */
  className?: string;
}

export interface DataTableProps<Row> {
  columns: ReadonlyArray<DataTableColumn<Row>>;
  rows: ReadonlyArray<Row>;
  /** Stable key per row. */
  rowKey: (row: Row, index: number) => string;
  /** Click handler — when set, rows show pointer cursor. */
  onRowClick?: (row: Row, index: number) => void;
  /** Row matched by this predicate gets the active background. */
  isRowActive?: (row: Row, index: number) => boolean;
  /** Render zebra striping (default true). */
  zebra?: boolean;
  /** Sticky header (default true). */
  stickyHeader?: boolean;
  /** Empty-state node rendered when `rows` is empty. */
  empty?: React.ReactNode;
  /** Additional class on the wrapping <div>. */
  className?: string;
}

/**
 * DataTable — opinionated table styled to match the DS reference
 * (PgPacientes / PgFinanceiro / PgSuprimentos): metal gradient header,
 * uppercase mono labels, zebra striping, optional sticky header.
 *
 * Renders semantic <table>, so it remains screen-reader friendly. For very
 * large datasets (>1k rows) prefer the existing `composites/data-table.tsx`
 * (TanStack + virtualized).
 */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  onRowClick,
  isRowActive,
  zebra = true,
  stickyHeader = true,
  empty,
  className,
}: DataTableProps<Row>) {
  if (rows.length === 0 && empty) {
    return <div className={className}>{empty}</div>;
  }
  return (
    <div className={className} style={{ width: '100%', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th
                key={i}
                style={{
                  padding: '9px 16px',
                  textAlign: col.align ?? 'left',
                  fontSize: 8,
                  fontFamily: "'IBM Plex Mono', monospace",
                  letterSpacing: '1.1px',
                  color: T.textMuted,
                  fontWeight: 500,
                  borderBottom: `1px solid ${T.divider}`,
                  background: T.metalGrad,
                  ...(stickyHeader ? { position: 'sticky', top: 0, zIndex: 1 } : null),
                  ...(col.width ? { width: col.width } : null),
                  textTransform: 'uppercase',
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const active = isRowActive?.(row, i) ?? false;
            return (
              <tr
                key={rowKey(row, i)}
                onClick={onRowClick ? () => onRowClick(row, i) : undefined}
                style={{
                  borderBottom: `1px solid ${T.divider}`,
                  background: active
                    ? T.primaryBg
                    : zebra && i % 2 !== 0
                      ? 'rgba(255,255,255,0.22)'
                      : 'transparent',
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: 'background 0.12s',
                }}
              >
                {columns.map((col, ci) => (
                  <td
                    key={ci}
                    className={col.className}
                    style={{
                      padding: '11px 16px',
                      textAlign: col.align ?? 'left',
                      fontSize: 12,
                      color: T.textPrimary,
                      verticalAlign: 'middle',
                    }}
                  >
                    {col.cell(row, i)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && !empty && (
        <div
          style={{
            padding: 24,
            textAlign: 'center',
            background: 'transparent',
          }}
        >
          <Mono size={9}>NENHUM REGISTRO</Mono>
        </div>
      )}
    </div>
  );
}
