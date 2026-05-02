'use client';

import * as React from 'react';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  SelectRoot, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Textarea,
  Checkbox,
  Badge,
} from '@dermaos/ui';
import { Trash2, GripVertical, Plus, ArrowUp, ArrowDown } from 'lucide-react';
import { trpc } from '@/lib/trpc-provider';
import { createKitSchema, type CreateKitInput } from '@dermaos/shared';

function Label({
  htmlFor, className = '', children,
}: { htmlFor?: string; className?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className={`text-sm font-medium leading-none ${className}`}>
      {children}
    </label>
  );
}

interface KitItemDraft {
  productId: string;
  productName: string;
  productUnit: string;
  quantity: number;
  isOptional: boolean;
  displayOrder: number;
  qtyInStock?: number;
}

interface KitEditorProps {
  open:    boolean;
  kitId:   string | null; // null = novo
  onClose: () => void;
  onSaved: () => void;
}

export function KitEditor({ open, kitId, onClose, onSaved }: KitEditorProps) {
  const utils = trpc.useUtils();
  const isEditing = !!kitId;

  const existing = trpc.supply.kits.getById.useQuery(
    { id: kitId ?? '' },
    { enabled: isEditing && open },
  );

  const servicesQ = trpc.scheduling.listServices.useQuery(
    undefined,
    { enabled: open, staleTime: 60_000 },
  );

  const [productSearch, setProductSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(productSearch), 300);
    return () => clearTimeout(t);
  }, [productSearch]);

  const productsQ = trpc.supply.products.list.useQuery(
    { search: debouncedSearch.length >= 2 ? debouncedSearch : undefined, page: 1, limit: 25 },
    { enabled: open && debouncedSearch.length >= 2, staleTime: 15_000 },
  );

  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [procedureTypeId, setProcedureTypeId] = React.useState('');
  const [items, setItems] = React.useState<KitItemDraft[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [acknowledgeVersioning, setAcknowledgeVersioning] = React.useState(false);
  const [needsVersioning, setNeedsVersioning] = React.useState(false);

  // Carregar dados do kit existente
  React.useEffect(() => {
    if (!open) {
      setName(''); setDescription(''); setProcedureTypeId(''); setItems([]);
      setError(null); setAcknowledgeVersioning(false); setNeedsVersioning(false);
      return;
    }
    if (isEditing && existing.data) {
      setName(existing.data.kit.name);
      setDescription(existing.data.kit.description ?? '');
      setProcedureTypeId(existing.data.kit.procedure_type_id ?? '');
      setItems(existing.data.items.map((it) => ({
        productId:   it.product_id,
        productName: it.product_name,
        productUnit: it.product_unit,
        quantity:    Number(it.quantity),
        isOptional:  it.is_optional,
        displayOrder: it.display_order,
      })));
    }
  }, [open, isEditing, existing.data]);

  const createMut = trpc.supply.kits.create.useMutation({
    onSuccess: () => { void utils.supply.kits.list.invalidate(); onSaved(); onClose(); },
    onError:   (err) => setError(err.message ?? 'Erro ao salvar kit'),
  });
  const updateMut = trpc.supply.kits.update.useMutation({
    onSuccess: () => { void utils.supply.kits.list.invalidate(); onSaved(); onClose(); },
    onError:   (err) => {
      if (err.data?.code === 'PRECONDITION_FAILED' && err.message.includes('versão')) {
        setNeedsVersioning(true);
        setError('Este kit tem consumos históricos. Confirme a criação de uma nova versão.');
      } else {
        setError(err.message ?? 'Erro ao salvar kit');
      }
    },
  });

  function addProduct(productId: string, productName: string, productUnit: string, qtyStock?: number) {
    if (items.some((it) => it.productId === productId)) {
      setError('Produto já adicionado ao kit.');
      return;
    }
    setItems([
      ...items,
      {
        productId, productName, productUnit,
        quantity: 1, isOptional: false,
        displayOrder: items.length,
        qtyInStock: qtyStock,
      },
    ]);
    setProductSearch('');
    setError(null);
  }

  function removeItem(idx: number) {
    const next = items.filter((_, i) => i !== idx).map((it, i) => ({ ...it, displayOrder: i }));
    setItems(next);
  }

  function moveItem(idx: number, delta: -1 | 1) {
    const tgt = idx + delta;
    if (tgt < 0 || tgt >= items.length) return;
    const next = [...items];
    [next[idx], next[tgt]] = [next[tgt]!, next[idx]!];
    setItems(next.map((it, i) => ({ ...it, displayOrder: i })));
  }

  function updateItem(idx: number, patch: Partial<KitItemDraft>) {
    setItems(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function handleSave() {
    setError(null);
    if (items.length === 0) {
      setError('Adicione ao menos um item ao kit.');
      return;
    }
    const payload: CreateKitInput = {
      name: name.trim(),
      description: description.trim() || null,
      procedureTypeId,
      items: items.map((it, i) => ({
        productId: it.productId,
        quantity:  it.quantity,
        isOptional: it.isOptional,
        displayOrder: i,
      })),
    };
    const parsed = createKitSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos');
      return;
    }
    if (isEditing) {
      updateMut.mutate({
        id: kitId!,
        name: payload.name,
        description: payload.description ?? null,
        procedureTypeId: payload.procedureTypeId,
        items: payload.items,
        acknowledgeVersioning: acknowledgeVersioning || needsVersioning,
      });
    } else {
      createMut.mutate(payload);
    }
  }

  const searchResults = productsQ.data?.data ?? [];
  const isLoading = createMut.isPending || updateMut.isPending;

  return (
    <DialogRoot open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Kit' : 'Novo Kit de Procedimento'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="kit-name">Nome do Kit *</Label>
              <Input id="kit-name" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Aplicação de Botox Glabela" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kit-procedure">Tipo de Procedimento *</Label>
              <SelectRoot value={procedureTypeId} onValueChange={setProcedureTypeId}>
                <SelectTrigger id="kit-procedure">
                  <SelectValue placeholder="Selecione o procedimento" />
                </SelectTrigger>
                <SelectContent>
                  {((servicesQ.data?.services ?? []) as Array<{ id: string; name: string }>).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </SelectRoot>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="kit-desc">Descrição</Label>
            <Textarea id="kit-desc" value={description} onChange={(e) => setDescription(e.target.value)}
              rows={2} maxLength={500} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Itens do Kit</Label>
              <span className="text-xs text-muted-foreground">{items.length} item(s)</span>
            </div>

            <div className="relative">
              <Input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Buscar produto para adicionar (min 2 caracteres)..."
              />
              {productSearch.length >= 2 && (
                <div className="absolute z-10 left-0 right-0 mt-1 max-h-56 overflow-y-auto border rounded-md bg-background shadow-lg">
                  {productsQ.isLoading && (
                    <p className="p-3 text-sm text-muted-foreground">Buscando…</p>
                  )}
                  {!productsQ.isLoading && searchResults.length === 0 && (
                    <p className="p-3 text-sm text-muted-foreground">Nenhum produto encontrado.</p>
                  )}
                  {searchResults.map((p: any) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addProduct(p.id, p.name, p.unit ?? 'unidade')}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                    >
                      <span className="font-medium">{p.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{p.unit}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="border rounded-md divide-y">
              {items.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center">
                  Nenhum item ainda. Use a busca acima para adicionar produtos.
                </p>
              ) : items.map((it, idx) => (
                <div key={it.productId} className="flex items-center gap-2 p-2">
                  <div className="flex flex-col">
                    <button
                      type="button" aria-label="Mover para cima"
                      disabled={idx === 0}
                      onClick={() => moveItem(idx, -1)}
                      className="p-1 rounded hover:bg-muted disabled:opacity-30"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button" aria-label="Mover para baixo"
                      disabled={idx === items.length - 1}
                      onClick={() => moveItem(idx, 1)}
                      className="p-1 rounded hover:bg-muted disabled:opacity-30"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>

                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" aria-hidden />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{it.productName}</p>
                    <p className="text-xs text-muted-foreground">{it.productUnit}</p>
                  </div>

                  <div className="w-24">
                    <Input
                      type="number" min="0.001" step="0.001"
                      value={it.quantity}
                      onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) || 0 })}
                      aria-label={`Quantidade de ${it.productName}`}
                    />
                  </div>

                  <label className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                    <Checkbox
                      checked={it.isOptional}
                      onCheckedChange={(v) => updateItem(idx, { isOptional: v === true })}
                    />
                    Opcional
                  </label>

                  <button
                    type="button" aria-label={`Remover ${it.productName}`}
                    onClick={() => removeItem(idx)}
                    className="p-1.5 rounded hover:bg-danger-50 text-danger-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {needsVersioning && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-warning-50 border border-warning-200">
              <Checkbox
                checked={acknowledgeVersioning}
                onCheckedChange={(v) => setAcknowledgeVersioning(v === true)}
                id="ack-version"
              />
              <div className="flex-1">
                <Label htmlFor="ack-version">
                  Este kit será versionado
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Consumos anteriores manterão a versão atual como referência histórica.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-md bg-danger-50 border border-danger-200 text-sm text-danger-700">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} isLoading={isLoading} disabled={items.length === 0}>
            {isEditing ? 'Salvar' : 'Criar Kit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
