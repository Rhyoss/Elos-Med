'use client';

import * as React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type RowSelectionState,
  type PaginationState,
  type VisibilityState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ChevronUp, ChevronDown, ChevronsUpDown,
  ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight,
  Download,
} from 'lucide-react';
import { cn } from '../utils.js';
import { Button } from '../primitives/button.js';
import { Checkbox } from '../primitives/checkbox.js';
import { EmptyState } from './empty-state.js';
import { LoadingSkeleton } from './loading-skeleton.js';

/* ── Tipos ──────────────────────────────────────────────────────────────── */

export type { ColumnDef };

export interface BulkAction<TData> {
  label: string;
  onClick: (rows: TData[]) => void;
  variant?: 'primary' | 'outline' | 'destructive';
}

export interface DataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData>[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: { label: string; onClick: () => void };
  selectable?: boolean;
  bulkActions?: BulkAction<TData>[];
  pageSize?: number;
  pageSizeOptions?: number[];
  enableVirtualization?: boolean;
  virtualRowHeight?: number;
  exportFilename?: string;
  onExport?: (data: TData[]) => void;
  className?: string;
  stickyHeader?: boolean;
}

/* ── Ícone de ordenação ──────────────────────────────────────────────────── */

function SortIcon({ direction }: { direction: 'asc' | 'desc' | false }) {
  if (direction === 'asc')  return <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />;
  if (direction === 'desc') return <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />;
  return <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden="true" />;
}

/* ── Export CSV ──────────────────────────────────────────────────────────── */

function exportToCsv<TData>(data: TData[], filename = 'export') {
  if (data.length === 0) return;
  const keys = Object.keys(data[0] as object);
  const rows = [
    keys.join(','),
    ...data.map((row) =>
      keys.map((k) => {
        const val = (row as Record<string, unknown>)[k];
        const str = val === null || val === undefined ? '' : String(val);
        return str.includes(',') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(','),
    ),
  ];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/* ── DataTable ───────────────────────────────────────────────────────────── */

export function DataTable<TData>({
  data,
  columns: columnsDef,
  isLoading,
  emptyTitle = 'Nenhum resultado',
  emptyDescription,
  emptyAction,
  selectable = false,
  bulkActions = [],
  pageSize: initialPageSize = 20,
  pageSizeOptions = [10, 20, 50, 100],
  enableVirtualization = false,
  virtualRowHeight = 48,
  exportFilename,
  onExport,
  className,
  stickyHeader = true,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize,
  });

  const scrollRef = React.useRef<HTMLDivElement>(null);

  /* Coluna de seleção */
  const selectionColumn: ColumnDef<TData> = {
    id: '__select__',
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={table.getIsSomePageRowsSelected()}
        onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
        aria-label="Selecionar todos"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(v) => row.toggleSelected(!!v)}
        aria-label={`Selecionar linha ${row.index + 1}`}
      />
    ),
    enableSorting: false,
    enableHiding: false,
    size: 40,
  };

  const columns = selectable ? [selectionColumn, ...columnsDef] : columnsDef;

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, rowSelection, columnVisibility, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: !enableVirtualization ? getPaginationRowModel() : undefined,
    enableRowSelection: selectable,
  });

  const { rows } = table.getRowModel();

  /* Virtual scroll */
  const virtualizer = useVirtualizer({
    count: enableVirtualization ? rows.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => virtualRowHeight,
    enabled: enableVirtualization,
  });

  const virtualItems = enableVirtualization ? virtualizer.getVirtualItems() : null;

  /* Linhas selecionadas */
  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
  const hasSelection = selectedRows.length > 0;

  /* Export */
  function handleExport() {
    const filtered = table.getFilteredRowModel().rows.map((r) => r.original);
    if (onExport) {
      onExport(filtered);
    } else {
      exportToCsv(filtered, exportFilename);
    }
  }

  /* ── Render ─────────────────────────────────────────────────────────── */

  return (
    <div className={cn('flex flex-col gap-0', className)}>
      {/* Toolbar de seleção em massa */}
      {hasSelection && bulkActions.length > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-2.5 bg-selected border border-primary/20 rounded-lg mb-2"
          role="toolbar"
          aria-label={`${selectedRows.length} itens selecionados`}
        >
          <span className="text-sm font-medium text-primary">
            {selectedRows.length} {selectedRows.length === 1 ? 'item selecionado' : 'itens selecionados'}
          </span>
          <div className="flex items-center gap-2 ml-auto">
            {bulkActions.map((action) => (
              <Button
                key={action.label}
                variant={action.variant ?? 'outline'}
                size="sm"
                onClick={() => action.onClick(selectedRows)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Tabela */}
      <div
        ref={scrollRef}
        className="relative overflow-auto rounded-lg border border-border"
        style={enableVirtualization ? { height: Math.min(rows.length * virtualRowHeight + 48, 600) } : undefined}
      >
        <table
          className="w-full text-sm border-collapse"
          role="grid"
          aria-rowcount={data.length}
          aria-busy={isLoading}
        >
          <thead className={cn('bg-muted/50', stickyHeader && 'sticky top-0 z-raised')}>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sortDir = header.column.getIsSorted();

                  return (
                    <th
                      key={header.id}
                      scope="col"
                      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                      className={cn(
                        'h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide',
                        'border-b border-border whitespace-nowrap',
                        canSort && 'cursor-pointer select-none hover:text-foreground',
                        header.id === '__select__' && 'px-3',
                      )}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      aria-sort={sortDir === 'asc' ? 'ascending' : sortDir === 'desc' ? 'descending' : undefined}
                    >
                      {header.isPlaceholder ? null : (
                        <div className="flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort && <SortIcon direction={sortDir} />}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          <tbody>
            {isLoading ? (
              <>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} aria-hidden="true">
                    {columns.map((col, j) => (
                      <td key={j} className="px-4 py-3 border-b border-border">
                        <LoadingSkeleton className="h-4 w-full max-w-[200px]" />
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  <EmptyState
                    title={emptyTitle}
                    description={emptyDescription}
                    action={emptyAction}
                    className="py-12"
                  />
                </td>
              </tr>
            ) : enableVirtualization && virtualItems ? (
              <>
                {virtualItems[0]?.start > 0 && (
                  <tr style={{ height: virtualItems[0].start }} aria-hidden="true" />
                )}
                {virtualItems.map((vItem) => {
                  const row = rows[vItem.index];
                  return (
                    <tr
                      key={row.id}
                      data-index={vItem.index}
                      className={cn(
                        'border-b border-border transition-colors hover:bg-hover',
                        row.getIsSelected() && 'bg-selected',
                      )}
                      aria-selected={row.getIsSelected()}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={cn(
                            'px-4 py-3 align-middle',
                            cell.column.id === '__select__' && 'px-3',
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {virtualItems.length > 0 && (
                  <tr
                    style={{ height: virtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end ?? 0) }}
                    aria-hidden="true"
                  />
                )}
              </>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b border-border transition-colors hover:bg-hover',
                    row.getIsSelected() && 'bg-selected',
                  )}
                  aria-selected={row.getIsSelected()}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        'px-4 py-3 align-middle',
                        cell.column.id === '__select__' && 'px-3',
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação + Export */}
      {!enableVirtualization && (
        <div className="flex items-center justify-between gap-4 pt-3">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              {table.getFilteredRowModel().rows.length} resultado{table.getFilteredRowModel().rows.length !== 1 ? 's' : ''}
            </span>
            <span aria-hidden="true">·</span>
            <label className="flex items-center gap-1.5">
              Linhas:
              <select
                value={pagination.pageSize}
                onChange={(e) => table.setPageSize(Number(e.target.value))}
                className="rounded border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                aria-label="Linhas por página"
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center gap-1">
            {(exportFilename || onExport) && (
              <Button variant="ghost" size="sm" onClick={handleExport} className="mr-2" aria-label="Exportar CSV">
                <Download className="h-4 w-4" aria-hidden="true" />
                Exportar
              </Button>
            )}

            <Button variant="ghost" size="icon" onClick={() => table.firstPage()} disabled={!table.getCanPreviousPage()} aria-label="Primeira página">
              <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Página anterior">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Button>

            <span className="text-sm text-muted-foreground px-2" aria-live="polite">
              Página {table.getState().pagination.pageIndex + 1} de {Math.max(1, table.getPageCount())}
            </span>

            <Button variant="ghost" size="icon" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Próxima página">
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => table.lastPage()} disabled={!table.getCanNextPage()} aria-label="Última página">
              <ChevronsRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
