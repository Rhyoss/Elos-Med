'use client';

import * as React from 'react';
import { Plus, Pencil, Trash2, History } from 'lucide-react';
import { trpc } from '@/lib/trpc-provider';
import { PageHeader } from '@dermaos/ui';
import type { CreateSettingsServiceInput } from '@dermaos/shared';

function formatCents(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

type ServiceRow = {
  id: string;
  name: string;
  category: string;
  tuss_code: string | null;
  price_cents: number;
  duration_min: number;
  is_active: boolean;
};

function ServiceModal({ service, onClose }: { service?: ServiceRow; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [form, setForm] = React.useState<CreateSettingsServiceInput>({
    name:        service?.name ?? '',
    category:    service?.category ?? 'consulta',
    tussCode:    service?.tuss_code ?? '',
    priceCents:  service?.price_cents ?? 0,
    durationMin: service?.duration_min ?? 30,
    description: '',
  });
  const [error, setError] = React.useState<string | null>(null);

  const createMut = trpc.settings.services.create.useMutation({
    onSuccess: () => { utils.settings.services.list.invalidate(); onClose(); },
    onError: (e) => setError(e.message),
  });
  const updateMut = trpc.settings.services.update.useMutation({
    onSuccess: () => { utils.settings.services.list.invalidate(); onClose(); },
    onError: (e) => setError(e.message),
  });

  const isPending = createMut.isPending || updateMut.isPending;

  function handleSubmit() {
    setError(null);
    const tussCode = form.tussCode || undefined;
    if (service) {
      updateMut.mutate({ id: service.id, ...form, tussCode });
    } else {
      createMut.mutate({ ...form, tussCode });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl border bg-background p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">{service ? 'Editar Serviço' : 'Novo Serviço'}</h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Nome *</label>
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full rounded-md border px-3 py-1.5 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Categoria *</label>
              <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                className="w-full rounded-md border px-3 py-1.5 text-sm">
                {['consulta', 'procedimento_estetico', 'procedimento_cirurgico', 'exame', 'produto', 'outro'].map((c) => (
                  <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Código TUSS</label>
              <input value={form.tussCode ?? ''} onChange={(e) => setForm((p) => ({ ...p, tussCode: e.target.value }))}
                placeholder="00000000" maxLength={8} className="w-full rounded-md border px-3 py-1.5 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Preço (R$) *</label>
              <input type="number" step="0.01" min="0"
                value={(form.priceCents / 100).toFixed(2)}
                onChange={(e) => setForm((p) => ({ ...p, priceCents: Math.round(parseFloat(e.target.value || '0') * 100) }))}
                className="w-full rounded-md border px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Duração (min) *</label>
              <input type="number" min="1" value={form.durationMin}
                onChange={(e) => setForm((p) => ({ ...p, durationMin: parseInt(e.target.value || '30') }))}
                className="w-full rounded-md border px-3 py-1.5 text-sm" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Descrição</label>
            <textarea value={form.description ?? ''} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={2} className="w-full rounded-md border px-3 py-1.5 text-sm" />
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        <div className="mt-4 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-md border px-4 py-2 text-sm">Cancelar</button>
          <button onClick={handleSubmit} disabled={isPending || !form.name}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
            {isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PriceHistoryModal({ serviceId, serviceName, onClose }: { serviceId: string; serviceName: string; onClose: () => void }) {
  const histQuery = trpc.settings.services.priceHistory.useQuery({ serviceId });
  const history = (histQuery.data ?? []) as { id: string; changed_at: string; old_price_cents: number; new_price_cents: number; changed_by_name: string | null }[];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl border bg-background p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">Histórico de Preços — {serviceName}</h2>
        {histQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma alteração registrada.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="py-2 text-left">Data</th>
                <th className="py-2 text-right">Anterior</th>
                <th className="py-2 text-right">Novo</th>
                <th className="py-2 pl-3 text-left">Por</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-t">
                  <td className="py-2">{new Date(h.changed_at).toLocaleDateString('pt-BR')}</td>
                  <td className="py-2 text-right text-muted-foreground line-through">{formatCents(h.old_price_cents)}</td>
                  <td className="py-2 text-right font-medium">{formatCents(h.new_price_cents)}</td>
                  <td className="py-2 pl-3 text-muted-foreground">{h.changed_by_name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="rounded-md border px-4 py-2 text-sm">Fechar</button>
        </div>
      </div>
    </div>
  );
}

export default function ServicosPage() {
  const utils = trpc.useUtils();
  const [modalService, setModalService] = React.useState<ServiceRow | 'new' | null>(null);
  const [histService, setHistService] = React.useState<{ id: string; name: string } | null>(null);

  const servicesQuery = trpc.settings.services.list.useQuery({ includeInactive: true });
  const deleteMut = trpc.settings.services.delete.useMutation({
    onSuccess: () => utils.settings.services.list.invalidate(),
  });

  const services = (servicesQuery.data ?? []) as ServiceRow[];

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Catálogo de Serviços"
        description="Procedimentos, valores e durações oferecidos pela clínica"
        actions={
          <button onClick={() => setModalService('new')}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            <Plus className="h-4 w-4" />Novo serviço
          </button>
        }
      />

      <div className="p-6">
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Nome</th>
                <th className="px-4 py-3 text-left font-medium">Categoria</th>
                <th className="px-4 py-3 text-left font-medium">TUSS</th>
                <th className="px-4 py-3 text-right font-medium">Preço</th>
                <th className="px-4 py-3 text-right font-medium">Duração</th>
                <th className="px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id} className={`border-t ${!s.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <span className="font-medium">{s.name}</span>
                    {!s.is_active && <span className="ml-2 text-xs text-muted-foreground">(desativado)</span>}
                  </td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">{s.category.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 font-mono text-xs">{s.tuss_code ?? '—'}</td>
                  <td className="px-4 py-3 text-right">{formatCents(s.price_cents)}</td>
                  <td className="px-4 py-3 text-right">{s.duration_min}min</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setHistService({ id: s.id, name: s.name })}
                        className="rounded-md p-1.5 hover:bg-accent" title="Histórico de preços">
                        <History className="h-4 w-4" />
                      </button>
                      <button onClick={() => setModalService(s)}
                        className="rounded-md p-1.5 hover:bg-accent" title="Editar">
                        <Pencil className="h-4 w-4" />
                      </button>
                      {s.is_active && (
                        <button
                          onClick={() => { if (confirm(`Desativar "${s.name}"?`)) deleteMut.mutate({ id: s.id }); }}
                          className="rounded-md p-1.5 text-destructive hover:bg-destructive/10" title="Desativar">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {services.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhum serviço cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalService === 'new' && <ServiceModal onClose={() => setModalService(null)} />}
      {modalService && modalService !== 'new' && <ServiceModal service={modalService} onClose={() => setModalService(null)} />}
      {histService && <PriceHistoryModal serviceId={histService.id} serviceName={histService.name} onClose={() => setHistService(null)} />}
    </div>
  );
}
