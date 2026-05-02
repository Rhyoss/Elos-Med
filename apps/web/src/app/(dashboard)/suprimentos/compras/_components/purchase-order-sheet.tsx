'use client';

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  SheetRoot, SheetContent, SheetHeader, SheetTitle, SheetFooter,
  SelectRoot, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Input,
} from '@dermaos/ui';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc-provider';
import {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  ORDER_URGENCIES,
  ORDER_URGENCY_LABELS,
  EDITABLE_STATUSES,
  type CreatePurchaseOrderInput,
  type PurchaseOrder,
  type PurchaseSuggestion,
} from '@dermaos/shared';

type FormValues = CreatePurchaseOrderInput;

interface PurchaseOrderSheetProps {
  open:             boolean;
  onClose:          () => void;
  onSuccess:        () => void;
  existingOrder?:   PurchaseOrder | null;
  prefillItems?:    PurchaseSuggestion[];
}

export function PurchaseOrderSheet({
  open,
  onClose,
  onSuccess,
  existingOrder,
  prefillItems,
}: PurchaseOrderSheetProps) {
  const utils   = trpc.useUtils();
  const isEdit  = !!existingOrder;
  const canEdit = !isEdit || EDITABLE_STATUSES.includes(existingOrder!.status);

  const suppliersQuery = trpc.supply.suppliers.list.useQuery(
    { limit: 200 },
    { enabled: open, staleTime: 60_000 },
  );
  const productsQuery = trpc.supply.products.list.useQuery(
    { isActive: true, limit: 200 },
    { enabled: open, staleTime: 60_000 },
  );

  const createMutation = trpc.supply.purchaseOrders.create.useMutation({
    onSuccess: () => {
      void utils.supply.purchaseOrders.list.invalidate();
      void utils.supply.purchaseOrders.suggestions.invalidate();
      onSuccess();
      onClose();
    },
  });
  const updateMutation = trpc.supply.purchaseOrders.update.useMutation({
    onSuccess: () => {
      void utils.supply.purchaseOrders.list.invalidate();
      onSuccess();
      onClose();
    },
  });

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(createPurchaseOrderSchema),
    defaultValues: {
      supplierId: existingOrder?.supplierId ?? '',
      urgency:    existingOrder?.urgency ?? 'normal',
      notes:      existingOrder?.notes ?? '',
      items:      existingOrder?.items?.map((i) => ({
        id:            i.id,
        productId:     i.productId,
        quantity:      i.quantityOrdered,
        estimatedCost: i.unitCost,
        notes:         i.notes ?? '',
      })) ?? [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  // Pre-fill from suggestions when sheet opens
  React.useEffect(() => {
    if (open && prefillItems && prefillItems.length > 0 && !isEdit) {
      reset({
        supplierId: prefillItems[0]!.suggestedSupplierId ?? '',
        urgency:    'normal',
        notes:      '',
        items: prefillItems.map((s) => ({
          productId:     s.productId,
          quantity:      s.qtySugerida,
          estimatedCost: s.lastUnitCost ?? 0,
          notes:         '',
        })),
      });
    }
  }, [open, prefillItems, isEdit, reset]);

  async function onSubmit(values: FormValues) {
    if (isEdit && existingOrder) {
      await updateMutation.mutateAsync({
        orderId:    existingOrder.id,
        supplierId: values.supplierId,
        urgency:    values.urgency,
        notes:      values.notes,
        items:      values.items,
      });
    } else {
      await createMutation.mutateAsync(values);
    }
  }

  const error = createMutation.error ?? updateMutation.error;

  return (
    <SheetRoot open={open} onOpenChange={(o: boolean) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full max-w-2xl overflow-y-auto"
        aria-label={isEdit ? 'Editar pedido de compra' : 'Novo pedido de compra'}
      >
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Editar Pedido' : 'Nova Requisição de Compra'}</SheetTitle>
        </SheetHeader>

        <form
          id="purchase-order-form"
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-6 py-6"
          aria-label="Formulário de pedido de compra"
        >
          {/* Fornecedor */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="supplierId" className="text-sm font-medium leading-none">Fornecedor *</label>
            <SelectRoot
              value={watch('supplierId')}
              onValueChange={(v) => setValue('supplierId', v, { shouldValidate: true })}
              disabled={!canEdit}
            >
              <SelectTrigger id="supplierId" aria-invalid={!!errors.supplierId}>
                <SelectValue placeholder="Selecione um fornecedor" />
              </SelectTrigger>
              <SelectContent>
                {suppliersQuery.data?.data.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </SelectRoot>
            {errors.supplierId && (
              <p className="text-xs text-red-600" role="alert">{errors.supplierId.message}</p>
            )}
          </div>

          {/* Urgência */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="urgency" className="text-sm font-medium leading-none">Urgência *</label>
            <SelectRoot
              value={watch('urgency')}
              onValueChange={(v) => setValue('urgency', v as FormValues['urgency'], { shouldValidate: true })}
              disabled={!canEdit}
            >
              <SelectTrigger id="urgency" aria-invalid={!!errors.urgency}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORDER_URGENCIES.map((u) => (
                  <SelectItem key={u} value={u}>{ORDER_URGENCY_LABELS[u]}</SelectItem>
                ))}
              </SelectContent>
            </SelectRoot>
          </div>

          {/* Entrega esperada */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="expectedDelivery" className="text-sm font-medium leading-none">Entrega esperada</label>
            <Input
              id="expectedDelivery"
              type="date"
              {...register('expectedDelivery')}
              disabled={!canEdit}
            />
          </div>

          {/* Itens */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium leading-none">Itens *</span>
              {canEdit && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => append({ productId: '', quantity: 1, estimatedCost: 0, notes: '' })}
                  aria-label="Adicionar item"
                >
                  <Plus className="mr-1 size-4" aria-hidden="true" />
                  Adicionar item
                </Button>
              )}
            </div>
            {errors.items && typeof errors.items === 'object' && 'message' in errors.items && (
              <p className="text-xs text-red-600" role="alert">{(errors.items as { message: string }).message}</p>
            )}
            <div className="flex flex-col gap-2">
              {fields.map((field, idx) => (
                <div
                  key={field.id}
                  className="grid grid-cols-[1fr_100px_100px_auto] gap-2 rounded-md border p-3"
                >
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`items.${idx}.productId`} className="text-xs text-muted-foreground">
                      Produto
                    </label>
                    <SelectRoot
                      value={watch(`items.${idx}.productId`)}
                      onValueChange={(v) => setValue(`items.${idx}.productId`, v, { shouldValidate: true })}
                      disabled={!canEdit}
                    >
                      <SelectTrigger
                        id={`items.${idx}.productId`}
                        aria-invalid={!!errors.items?.[idx]?.productId}
                      >
                        <SelectValue placeholder="Produto..." />
                      </SelectTrigger>
                      <SelectContent>
                        {productsQuery.data?.data.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} {p.sku ? `(${p.sku})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </SelectRoot>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`items.${idx}.quantity`} className="text-xs text-muted-foreground">
                      Qtd
                    </label>
                    <Input
                      id={`items.${idx}.quantity`}
                      type="number"
                      min={0.001}
                      step="any"
                      {...register(`items.${idx}.quantity`, { valueAsNumber: true })}
                      disabled={!canEdit}
                      aria-invalid={!!errors.items?.[idx]?.quantity}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`items.${idx}.estimatedCost`} className="text-xs text-muted-foreground">
                      Pr. Unit.
                    </label>
                    <Input
                      id={`items.${idx}.estimatedCost`}
                      type="number"
                      min={0}
                      step="0.01"
                      {...register(`items.${idx}.estimatedCost`, { valueAsNumber: true })}
                      disabled={!canEdit}
                      aria-invalid={!!errors.items?.[idx]?.estimatedCost}
                    />
                  </div>
                  {canEdit && (
                    <div className="flex items-end pb-0.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => remove(idx)}
                        aria-label={`Remover item ${idx + 1}`}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Observações */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="notes" className="text-sm font-medium leading-none">Observações</label>
            <textarea
              id="notes"
              {...register('notes')}
              rows={3}
              disabled={!canEdit}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Observações gerais sobre o pedido..."
              aria-label="Observações sobre o pedido"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{(error as { message?: string }).message ?? 'Erro ao salvar pedido.'}</span>
            </div>
          )}
        </form>

        {canEdit && (
          <SheetFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="purchase-order-form"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar Rascunho'}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </SheetRoot>
  );
}
