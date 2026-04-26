'use client';

import * as React from 'react';
import {
  Button, Input, Badge,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  DropdownMenuRoot, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@dermaos/ui';
import { Btn, PageHero } from '@dermaos/ui/ds';
import { Plus, Pencil, Archive, MoreVertical, Search, PackageOpen } from 'lucide-react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc-provider';
import { useDebounce } from '@/lib/utils';
import {
  KIT_AVAILABILITY_STATUSES, KIT_AVAILABILITY_LABELS,
  type KitAvailabilityStatus,
} from '@dermaos/shared';
import { useRealtime } from '@/hooks/use-realtime';

import { SuprimentosTabs } from '../_components/suprimentos-tabs';
import { KitEditor } from '../_components/kit-editor';
import { KitAvailabilityBadge } from '../_components/kit-availability-badge';

const PAGE_SIZE = 50;

function AvailabilityCell({ kitId }: { kitId: string }) {
  const q = trpc.supply.kits.availability.useQuery(
    { kitId },
    { staleTime: 30_000 },
  );
  if (q.isLoading) return <span className="text-xs text-muted-foreground">...</span>;
  if (!q.data) return <span className="text-xs text-muted-foreground">—</span>;
  return <KitAvailabilityBadge status={q.data.status} />;
}

export default function KitsPage() {
  const router   = useRouter();
  const pathname = usePathname();
  const params   = useSearchParams();

  const searchQ    = params.get('q') ?? '';
  const procFilter = params.get('procedure') ?? '';
  const availFilter = params.get('avail') ?? '';
  const page       = Number(params.get('page') ?? '1');

  const [localSearch, setLocalSearch] = React.useState(searchQ);
  const debouncedSearch = useDebounce(localSearch, 300);

  React.useEffect(() => {
    if (debouncedSearch === searchQ) return;
    const next = new URLSearchParams(params.toString());
    if (debouncedSearch.length >= 2) next.set('q', debouncedSearch); else next.delete('q');
    next.delete('page');
    router.replace(`${pathname}?${next.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    next.delete('page');
    router.replace(`${pathname}?${next.toString()}`);
  }

  function setPage(p: number) {
    const next = new URLSearchParams(params.toString());
    if (p === 1) next.delete('page'); else next.set('page', String(p));
    router.replace(`${pathname}?${next.toString()}`);
  }

  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editingKitId, setEditingKitId] = React.useState<string | null>(null);

  const utils = trpc.useUtils();
  const listQ = trpc.supply.kits.list.useQuery(
    {
      search:          debouncedSearch.length >= 2 ? debouncedSearch : undefined,
      procedureTypeId: procFilter || undefined,
      availability:    (availFilter as KitAvailabilityStatus) || undefined,
      page,
      limit: PAGE_SIZE,
    },
    { placeholderData: (prev) => prev, staleTime: 30_000 },
  );

  const servicesQ = trpc.scheduling.listServices.useQuery(undefined, { staleTime: 60_000 });

  const archiveMut = trpc.supply.kits.archive.useMutation({
    onSuccess: () => { void utils.supply.kits.list.invalidate(); },
  });

  useRealtime(['supply.kit_changed'], () => {
    void utils.supply.kits.list.invalidate();
  });

  const rows       = listQ.data?.data ?? [];
  const total      = listQ.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = !!(procFilter || availFilter || searchQ);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <SuprimentosTabs />

      <PageHero
        eyebrow="INSUMOS POR PROCEDIMENTO"
        title="Kits de Procedimento"
        module="supply"
        icon="layers"
        description="Configure insumos padrão por tipo de procedimento"
        actions={
          <>
            <Link href="/suprimentos/kits/consumir" passHref style={{ textDecoration: 'none' }}>
              <Btn variant="glass" small icon="box">Registrar Consumo</Btn>
            </Link>
            <Btn small icon="plus" onClick={() => { setEditingKitId(null); setEditorOpen(true); }}>
              Novo Kit
            </Btn>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar kit por nome..."
            className="pl-8"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
        </div>
        <Select value={procFilter || '__all__'} onValueChange={(v) => updateParam('procedure', v === '__all__' ? '' : v)}>
          <SelectTrigger className="h-9 w-[200px]">
            <SelectValue placeholder="Procedimento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os procedimentos</SelectItem>
            {((servicesQ.data?.services ?? []) as Array<{ id: string; name: string }>).map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={availFilter || '__all__'} onValueChange={(v) => updateParam('avail', v === '__all__' ? '' : v)}>
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder="Disponibilidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas</SelectItem>
            {KIT_AVAILABILITY_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{KIT_AVAILABILITY_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setLocalSearch(''); router.replace(pathname); }}>
            Limpar
          </Button>
        )}
      </div>

      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">Nome do Kit</th>
              <th className="px-3 py-2 font-medium">Procedimento</th>
              <th className="px-3 py-2 font-medium text-center">Itens</th>
              <th className="px-3 py-2 font-medium">Disponibilidade</th>
              <th className="px-3 py-2 font-medium">Versão</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {listQ.isLoading && (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skl-${i}`} className="border-t">
                  <td colSpan={6} className="px-3 py-3">
                    <div className="h-4 w-full animate-pulse rounded bg-muted" />
                  </td>
                </tr>
              ))
            )}
            {!listQ.isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  {hasFilters
                    ? 'Nenhum kit corresponde aos filtros.'
                    : 'Nenhum kit cadastrado. Crie seu primeiro kit de procedimento.'}
                </td>
              </tr>
            )}
            {rows.map((k: any) => (
              <tr key={k.id} className="border-t hover:bg-muted/30">
                <td className="px-3 py-2 font-medium">{k.name}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {k.procedure_type_name ?? '—'}
                </td>
                <td className="px-3 py-2 text-center">{k.items_count}</td>
                <td className="px-3 py-2">
                  <AvailabilityCell kitId={k.id} />
                </td>
                <td className="px-3 py-2">
                  <Badge variant="neutral">v{k.version}</Badge>
                </td>
                <td className="px-3 py-2 text-right">
                  <DropdownMenuRoot>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Ações">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => { setEditingKitId(k.id); setEditorOpen(true); }}>
                        <Pencil className="mr-2 h-4 w-4" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => {
                        if (confirm(`Arquivar o kit "${k.name}"?`)) {
                          archiveMut.mutate({ id: k.id });
                        }
                      }}>
                        <Archive className="mr-2 h-4 w-4" /> Arquivar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenuRoot>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {page} de {totalPages} · {total} kit(s)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              Próxima
            </Button>
          </div>
        </div>
      )}

      <KitEditor
        open={editorOpen}
        kitId={editingKitId}
        onClose={() => setEditorOpen(false)}
        onSaved={() => { void utils.supply.kits.list.invalidate(); }}
      />
    </div>
  );
}
