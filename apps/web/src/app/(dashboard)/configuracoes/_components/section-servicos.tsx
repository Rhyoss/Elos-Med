'use client';

import * as React from 'react';
import {
  Glass, Btn, Mono, Badge, MetalTag, Ico, DataTable, EmptyState,
  Field, Input, Skeleton, T, type DataTableColumn,
} from '@dermaos/ui/ds';
import {
  DialogRoot, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
  ConfirmDialog,
} from '@dermaos/ui';
import { Button } from '@dermaos/ui';
import { trpc } from '@/lib/trpc-provider';
import { useAuth } from '@/lib/auth';

interface ServiceRow {
  id: string;
  name: string;
  category: string;
  tuss_code?: string | null;
  price_cents: number;
  duration_min: number;
  description?: string | null;
  is_active: boolean;
}

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function SectionServicos() {
  const { user } = useAuth();
  const isPrivileged = user?.role === 'owner' || user?.role === 'admin';

  const servicesQuery = trpc.settings.services.list.useQuery(
    { includeInactive: true },
    { staleTime: 30_000 },
  );

  const createService = trpc.settings.services.create.useMutation({
    onSuccess: () => { servicesQuery.refetch(); setShowCreate(false); resetForm(); },
  });
  const updateService = trpc.settings.services.update.useMutation({
    onSuccess: () => { servicesQuery.refetch(); setEditingService(null); },
  });
  const deleteService = trpc.settings.services.delete.useMutation({
    onSuccess: () => { servicesQuery.refetch(); setDeletingService(null); },
  });

  const [showCreate, setShowCreate] = React.useState(false);
  const [editingService, setEditingService] = React.useState<ServiceRow | null>(null);
  const [deletingService, setDeletingService] = React.useState<ServiceRow | null>(null);
  const [priceHistoryService, setPriceHistoryService] = React.useState<ServiceRow | null>(null);

  const priceHistoryQuery = trpc.settings.services.priceHistory.useQuery(
    { serviceId: priceHistoryService?.id ?? '' },
    { enabled: !!priceHistoryService, staleTime: 30_000 },
  );

  const [formName, setFormName] = React.useState('');
  const [formCategory, setFormCategory] = React.useState('');
  const [formTuss, setFormTuss] = React.useState('');
  const [formPrice, setFormPrice] = React.useState('');
  const [formDuration, setFormDuration] = React.useState('');
  const [formDescription, setFormDescription] = React.useState('');
  const [formError, setFormError] = React.useState('');

  function resetForm() {
    setFormName(''); setFormCategory(''); setFormTuss('');
    setFormPrice(''); setFormDuration(''); setFormDescription('');
    setFormError('');
  }

  function loadFormFromService(s: ServiceRow) {
    setFormName(s.name);
    setFormCategory(s.category);
    setFormTuss(s.tuss_code ?? '');
    setFormPrice(String(s.price_cents));
    setFormDuration(String(s.duration_min));
    setFormDescription(s.description ?? '');
    setFormError('');
  }

  function validateForm(): boolean {
    if (!formName.trim()) { setFormError('Nome obrigatório.'); return false; }
    if (!formCategory.trim()) { setFormError('Categoria obrigatória.'); return false; }
    const p = Number(formPrice);
    if (isNaN(p) || p < 0) { setFormError('Preço inválido (em centavos).'); return false; }
    const d = Number(formDuration);
    if (isNaN(d) || d <= 0) { setFormError('Duração deve ser maior que zero.'); return false; }
    if (formTuss && !/^\d{8}$/.test(formTuss)) { setFormError('Código TUSS deve ter 8 dígitos.'); return false; }
    setFormError('');
    return true;
  }

  function handleCreate() {
    if (!validateForm()) return;
    createService.mutate({
      name: formName.trim(),
      category: formCategory.trim(),
      tussCode: formTuss || undefined,
      priceCents: Number(formPrice),
      durationMin: Number(formDuration),
      description: formDescription.trim() || undefined,
    });
  }

  function handleUpdate() {
    if (!editingService || !validateForm()) return;
    updateService.mutate({
      id: editingService.id,
      name: formName.trim(),
      category: formCategory.trim(),
      tussCode: formTuss || undefined,
      priceCents: Number(formPrice),
      durationMin: Number(formDuration),
      description: formDescription.trim() || undefined,
    });
  }

  const columns: DataTableColumn<ServiceRow>[] = [
    {
      header: 'Serviço',
      cell: (row) => (
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>{row.name}</p>
          {row.tuss_code && <Mono size={10}>TUSS {row.tuss_code}</Mono>}
        </div>
      ),
    },
    {
      header: 'Categoria',
      cell: (row) => <MetalTag>{row.category}</MetalTag>,
      width: 140,
    },
    {
      header: 'Preço',
      cell: (row) => (
        <span style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary, fontFamily: "'IBM Plex Mono', monospace" }}>
          {formatPrice(row.price_cents)}
        </span>
      ),
      width: 120,
      align: 'right',
    },
    {
      header: 'Duração',
      cell: (row) => <Mono size={12}>{row.duration_min} min</Mono>,
      width: 90,
      align: 'center',
    },
    {
      header: 'Status',
      cell: (row) => (
        <Badge variant={row.is_active ? 'success' : 'danger'}>
          {row.is_active ? 'Ativo' : 'Inativo'}
        </Badge>
      ),
      width: 100,
    },
    ...(isPrivileged ? [{
      header: 'Ações',
      width: 160,
      cell: (row: ServiceRow) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <Btn small variant="ghost" icon="edit" iconOnly onClick={() => { setEditingService(row); loadFormFromService(row); }} />
          <Btn small variant="ghost" icon="clock" iconOnly onClick={() => setPriceHistoryService(row)} />
          {row.is_active && (
            <Btn small variant="ghost" icon="x" iconOnly onClick={() => setDeletingService(row)} />
          )}
        </div>
      ),
    } as DataTableColumn<ServiceRow>] : []),
  ];

  const renderFormFields = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {formError && (
        <div style={{ padding: '8px 12px', borderRadius: T.r.md, background: T.dangerBg, border: `1px solid ${T.dangerBorder}`, fontSize: 13, color: T.danger }}>
          {formError}
        </div>
      )}
      <Field label="Nome do serviço" required>
        <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Consulta dermatológica" />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field label="Categoria" required>
          <Input value={formCategory} onChange={(e) => setFormCategory(e.target.value)} placeholder="consulta, procedimento..." />
        </Field>
        <Field label="Código TUSS">
          <Input value={formTuss} onChange={(e) => setFormTuss(e.target.value)} placeholder="00000000" maxLength={8} style={{ fontFamily: "'IBM Plex Mono', monospace" }} />
        </Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field label="Preço (centavos)" required>
          <Input value={formPrice} onChange={(e) => setFormPrice(e.target.value)} placeholder="15000" type="number" style={{ fontFamily: "'IBM Plex Mono', monospace" }} />
        </Field>
        <Field label="Duração (min)" required>
          <Input value={formDuration} onChange={(e) => setFormDuration(e.target.value)} placeholder="30" type="number" style={{ fontFamily: "'IBM Plex Mono', monospace" }} />
        </Field>
      </div>
      <Field label="Descrição">
        <Input value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Descrição do serviço..." />
      </Field>
      {formPrice && !isNaN(Number(formPrice)) && (
        <Mono size={11} color={T.textMuted}>
          Valor exibido: {formatPrice(Number(formPrice))}
        </Mono>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {isPrivileged && (
          <Btn small icon="plus" onClick={() => { setShowCreate(true); resetForm(); }}>
            Novo serviço
          </Btn>
        )}
      </div>

      <Glass style={{ padding: 0, overflow: 'hidden' }}>
        {servicesQuery.isLoading ? (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} height={48} delay={i * 80} />)}
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={(servicesQuery.data as ServiceRow[]) ?? []}
            rowKey={(r) => r.id}
            empty={
              <EmptyState
                icon="box"
                title="Nenhum serviço cadastrado"
                description="Crie o catálogo de serviços da clínica para usar na agenda e financeiro."
                action={isPrivileged ? <Btn small icon="plus" onClick={() => { setShowCreate(true); resetForm(); }}>Criar serviço</Btn> : undefined}
              />
            }
          />
        )}
      </Glass>

      {/* Create Dialog */}
      <DialogRoot open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent a11yTitle="Novo serviço">
          <DialogHeader>
            <DialogTitle>Novo Serviço</DialogTitle>
            <DialogDescription>Adicione um serviço ao catálogo da clínica.</DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4">
            {createService.error && (
              <div style={{ padding: '8px 12px', borderRadius: T.r.md, background: T.dangerBg, border: `1px solid ${T.dangerBorder}`, fontSize: 13, color: T.danger, marginBottom: 12 }}>
                {createService.error.message}
              </div>
            )}
            {renderFormFields()}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleCreate} isLoading={createService.isPending}>Criar serviço</Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>

      {/* Edit Dialog */}
      <DialogRoot open={!!editingService} onOpenChange={(open) => !open && setEditingService(null)}>
        <DialogContent a11yTitle="Editar serviço">
          <DialogHeader>
            <DialogTitle>Editar — {editingService?.name}</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4">
            {updateService.error && (
              <div style={{ padding: '8px 12px', borderRadius: T.r.md, background: T.dangerBg, border: `1px solid ${T.dangerBorder}`, fontSize: 13, color: T.danger, marginBottom: 12 }}>
                {updateService.error.message}
              </div>
            )}
            {renderFormFields()}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleUpdate} isLoading={updateService.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deletingService}
        onOpenChange={(open) => !open && setDeletingService(null)}
        title={`Desativar "${deletingService?.name ?? ''}"?`}
        description="O serviço será marcado como inativo e não aparecerá na agenda. Pode ser reativado depois."
        confirmLabel="Desativar"
        onConfirm={() => { if (deletingService) deleteService.mutate({ id: deletingService.id }); }}
        isLoading={deleteService.isPending}
      />

      {/* Price History Dialog */}
      <DialogRoot open={!!priceHistoryService} onOpenChange={(open) => !open && setPriceHistoryService(null)}>
        <DialogContent a11yTitle="Histórico de preços">
          <DialogHeader>
            <DialogTitle>Histórico de Preços — {priceHistoryService?.name}</DialogTitle>
            <DialogDescription>Últimas 50 alterações de preço.</DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4" style={{ maxHeight: 360, overflowY: 'auto' }}>
            {priceHistoryQuery.isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} height={36} delay={i * 80} />)}
              </div>
            ) : priceHistoryQuery.data && (priceHistoryQuery.data as Array<{ id: string; old_price_cents: number; new_price_cents: number; changed_at: string }>).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(priceHistoryQuery.data as Array<{ id: string; old_price_cents: number; new_price_cents: number; changed_at: string }>).map((entry) => (
                  <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: T.r.sm, background: T.inputBg, border: `1px solid ${T.divider}` }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Mono size={12} color={T.danger}>{formatPrice(entry.old_price_cents)}</Mono>
                      <Ico name="arrowRight" size={12} color={T.textMuted} />
                      <Mono size={12} color={T.success}>{formatPrice(entry.new_price_cents)}</Mono>
                    </div>
                    <Mono size={10}>{new Date(entry.changed_at).toLocaleDateString('pt-BR')}</Mono>
                  </div>
                ))}
              </div>
            ) : (
              <Mono size={12} color={T.textMuted}>Nenhuma alteração de preço registrada.</Mono>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Fechar</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </div>
  );
}
