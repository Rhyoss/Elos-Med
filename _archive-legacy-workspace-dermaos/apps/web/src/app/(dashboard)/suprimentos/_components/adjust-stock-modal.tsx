'use client';

import * as React from 'react';
import {
  DialogRoot as Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Textarea,
} from '@dermaos/ui';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { trpc } from '@/lib/trpc-provider';
import { ADJUSTMENT_REASON_LABELS, type AdjustmentReason } from '@dermaos/shared';
import type { StockRow } from './stock-table';

interface AdjustStockModalProps {
  product:  StockRow | null;
  onClose:  () => void;
  onSaved:  () => void;
}

const formSchema = z.object({
  reason:   z.enum(['contagem', 'perda', 'correcao'] as const),
  quantity: z.string().min(1, 'Quantidade obrigatória').refine(
    v => !isNaN(Number(v)) && Number(v) !== 0,
    'Quantidade deve ser um número diferente de zero',
  ),
  notes: z.string().max(500).optional(),
});

type FormData = z.infer<typeof formSchema>;

const REASON_HINTS: Record<AdjustmentReason, string> = {
  contagem: 'Informe a contagem total encontrada no estoque físico.',
  perda:    'Informe a quantidade perdida, extraviada ou descartada (> 0).',
  correcao: 'Informe o delta: positivo para adicionar, negativo para remover.',
};

export function AdjustStockModal({ product, onClose, onSaved }: AdjustStockModalProps) {
  const utils = trpc.useUtils();

  const adjustMutation = trpc.supply.stock.adjust.useMutation({
    onSuccess: () => {
      void utils.supply.stock.position.invalidate();
      void utils.supply.stock.lots.invalidate();
      void utils.supply.stock.movements.invalidate();
      onSaved();
      onClose();
    },
  });

  const {
    register, handleSubmit, control, watch, reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { reason: 'contagem', quantity: '', notes: '' },
  });

  const reason = watch('reason') as AdjustmentReason;

  React.useEffect(() => {
    if (!product) reset({ reason: 'contagem', quantity: '', notes: '' });
  }, [product, reset]);

  async function onSubmit(data: FormData) {
    if (!product) return;
    await adjustMutation.mutateAsync({
      productId: product.id,
      reason:    data.reason,
      quantity:  Number(data.quantity),
      notes:     data.notes || undefined,
    });
  }

  return (
    <Dialog open={!!product} onOpenChange={open => !open && onClose()}>
      <DialogContent
        className="sm:max-w-md"
        aria-labelledby="adjust-modal-title"
      >
        <DialogHeader>
          <DialogTitle id="adjust-modal-title">
            Ajustar Estoque
          </DialogTitle>
          {product && (
            <p className="text-sm text-muted-foreground">
              {product.name}
              {product.sku && (
                <span className="ml-2 font-mono text-xs">{product.sku}</span>
              )}
              {' · '}
              <span className="font-medium">
                Atual: {formatQty(product.qty_total)} {product.unit}
              </span>
            </p>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-4 py-2">
            {/* Motivo */}
            <div className="space-y-1.5">
              <Label htmlFor="adjust-reason">
                Motivo <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <Controller
                name="reason"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="adjust-reason" aria-label="Motivo do ajuste">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(['contagem', 'perda', 'correcao'] as const).map((r) => (
                        <SelectItem key={r} value={r}>
                          {ADJUSTMENT_REASON_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-muted-foreground">{REASON_HINTS[reason]}</p>
            </div>

            {/* Quantidade */}
            <div className="space-y-1.5">
              <Label htmlFor="adjust-qty">
                Quantidade <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <input
                  {...register('quantity')}
                  id="adjust-qty"
                  type="number"
                  step="any"
                  placeholder={reason === 'correcao' ? 'ex: 5 ou -3' : 'ex: 10'}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-describedby={errors.quantity ? 'adjust-qty-error' : undefined}
                  aria-invalid={!!errors.quantity}
                />
                {product && (
                  <span className="shrink-0 text-sm text-muted-foreground">{product.unit}</span>
                )}
              </div>
              {errors.quantity && (
                <p id="adjust-qty-error" className="text-xs text-destructive" role="alert">
                  {errors.quantity.message}
                </p>
              )}
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <Label htmlFor="adjust-notes">Observações</Label>
              <Textarea
                {...register('notes')}
                id="adjust-notes"
                placeholder="Informações adicionais (opcional)..."
                rows={3}
                className="resize-none"
                maxLength={500}
              />
            </div>

            {adjustMutation.isError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {adjustMutation.error.message}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || adjustMutation.isPending}>
              {isSubmitting || adjustMutation.isPending ? 'Salvando...' : 'Salvar Ajuste'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function formatQty(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}
