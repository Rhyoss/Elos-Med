'use client';

import * as React from 'react';
import Link from 'next/link';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@dermaos/ui';
import { Plus } from 'lucide-react';
import { Btn, Input as DSInput, PageHero } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { keepPreviousData } from '@tanstack/react-query';
import { TemplateCard } from './_components/template-card';
import type { TemplateRow } from '@/lib/types/template';

const CHANNEL_OPTIONS = [
  { value: 'all',      label: 'Todos os canais' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'sms',      label: 'SMS' },
  { value: 'email',    label: 'E-mail' },
];

export default function TemplatesPage() {
  const [channel, setChannel] = React.useState<string>('all');
  const [search,  setSearch]  = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');

  // Debounce 300ms para busca
  React.useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const utils = trpc.useUtils();

  const query = trpc.templates.list.useQuery(
    {
      channel:  channel !== 'all' ? channel as 'whatsapp' | 'sms' | 'email' : undefined,
      search:   debouncedSearch.length >= 2 ? debouncedSearch : undefined,
      limit:    60,
    },
    { placeholderData: keepPreviousData, staleTime: 15_000 },
  );

  const deleteMutation = trpc.templates.delete.useMutation({
    onSuccess: () => void utils.templates.list.invalidate(),
  });

  const seedMutation = trpc.templates.seedDefaults.useMutation({
    onSuccess: (data) => {
      void utils.templates.list.invalidate();
      if (data.created > 0) {
        alert(`${data.created} template${data.created !== 1 ? 's' : ''} padrão adicionado${data.created !== 1 ? 's' : ''}.`);
      }
    },
  });

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Excluir o template "${name}"? Esta ação não pode ser desfeita.`)) return;
    await deleteMutation.mutateAsync({ id });
  }

  const templates = (query.data?.data ?? []) as TemplateRow[];
  const defaultCount = templates.filter((t) => t.is_default).length;

  return (
    <div style={{ overflowY: 'auto', height: '100%', padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <PageHero
        eyebrow="BIBLIOTECA DE MENSAGENS"
        title="Templates"
        module="aiMod"
        icon="file"
        description={
          <>
            {templates.length} template{templates.length !== 1 ? 's' : ''}
            {defaultCount > 0 && ` · ${defaultCount} padrão${defaultCount !== 1 ? 's' : ''}`}
          </>
        }
        actions={
          <>
            <Btn
              variant="glass"
              small
              icon="download"
              onClick={() => seedMutation.mutate()}
              loading={seedMutation.isPending}
              aria-label="Carregar templates padrão"
            >
              {seedMutation.isPending ? 'Criando…' : 'Carregar padrões'}
            </Btn>
            <Link href="/comunicacoes/templates/novo" style={{ textDecoration: 'none' }}>
              <Btn small icon="plus">Novo Template</Btn>
            </Link>
          </>
        }
      />

      {/* Filtros DS */}
      <div role="group" aria-label="Filtros de templates" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ width: 240 }}>
          <DSInput
            leadingIcon="search"
            type="search"
            placeholder="Buscar templates…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar templates pelo nome"
          />
        </div>

        <Select value={channel} onValueChange={setChannel}>
          <SelectTrigger className="w-40" aria-label="Filtrar por canal">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHANNEL_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(channel !== 'all' || debouncedSearch) && (
          <Btn
            variant="ghost"
            small
            icon="x"
            onClick={() => { setChannel('all'); setSearch(''); }}
            aria-label="Limpar filtros"
          >
            Limpar filtros
          </Btn>
        )}
      </div>

      {/* Erro */}
      {query.isError && (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          Falha ao carregar templates. {query.error.message}
        </div>
      )}

      {/* Grid */}
      {query.isError ? null : query.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <div className="rounded-full bg-muted p-4">
            <Plus className="h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
          </div>
          <div>
            <p className="font-medium">Nenhum template encontrado</p>
            <p className="text-sm text-muted-foreground">
              {debouncedSearch || channel !== 'all'
                ? 'Nenhum resultado para os filtros aplicados.'
                : 'Crie o primeiro template ou carregue os padrões do sistema.'}
            </p>
          </div>
        </div>
      ) : (
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          aria-label="Lista de templates"
        >
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
