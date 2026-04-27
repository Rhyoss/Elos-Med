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
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Textarea,
  Checkbox,
} from '@dermaos/ui';

function Label({
  htmlFor,
  className = '',
  children,
}: {
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={`text-sm font-medium leading-none ${className}`}
    >
      {children}
    </label>
  );
}
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { trpc } from '@/lib/trpc-provider';
import {
  registerMovementSchema,
  MOVEMENT_TYPES,
  MOVEMENT_TYPE_LABELS,
  MOVEMENT_REASON_LABELS,
  SAIDA_REASONS,
  AJUSTE_REASONS,
  ENTRADA_REASONS,
  MIN_JUSTIFICATION_LENGTH,
  type MovementType,
  type MovementReason,
  type RegisterMovementInput,
} from '@dermaos/shared';
import type { LotRow } from './lots-table';

/* ── Initial context passed in by caller (page or row menu) ──────────────── */

export type MovementModalInitial =
  | { type: 'entrada';       productId?: string }
  | { type: 'saida';         productId?: string; lotId?: string }
  | { type: 'ajuste';        productId?: string; lotId?: string }
  | { type: 'transferencia'; productId: string;  lotId: string; fromStorageLocationId?: string | null };

interface MovementModalProps {
  open:         boolean;
  initial:      MovementModalInitial | null;
  /** Optional: caller can pass a lot row to prefill product + lot name display. */
  contextLot?:  LotRow | null;
  onClose:      () => void;
  onSaved:      () => void;
}

type FormValues = RegisterMovementInput;

const TYPE_OPTIONS: ReadonlyArray<MovementType> = MOVEMENT_TYPES.filter(
  (t) => t === 'entrada' || t === 'saida' || t === 'ajuste' || t === 'transferencia',
) as ReadonlyArray<MovementType>;

const TYPE_OPTION_LABELS: Record<'entrada' | 'saida' | 'ajuste' | 'transferencia', string> = {
  entrada:       MOVEMENT_TYPE_LABELS.entrada,
  saida:         MOVEMENT_TYPE_LABELS.saida,
  ajuste:        MOVEMENT_TYPE_LABELS.ajuste,
  transferencia: MOVEMENT_TYPE_LABELS.transferencia,
};

export function MovementModal({
  open,
  initial,
  contextLot,
  onClose,
  onSaved,
}: MovementModalProps) {
  const utils = trpc.useUtils();

  // Default form values keyed by type — rebuilt when modal opens.
  const defaultValues = React.useMemo<FormValues>(() => {
    const init = initial ?? { type: 'entrada' as const };
    switch (init.type) {
      case 'entrada':
        return {
          type:         'entrada',
          productId:    init.productId ?? '',
          lotNumber:    '',
          batchNumber:  null,
          expiryDate:   null,
          manufacturedDate: null,
          quantity:     1,
          unitCost:     0,
          supplierId:   null,
          storageLocationId: null,
          purchaseOrderItemId: null,
          reason:       'recebimento',
          notes:        null,
          acceptExpired: false,
          acceptExpiredReason: null,
        } as FormValues;
      case 'saida':
        return {
          type:       'saida',
          productId:  init.productId ?? contextLot?.product_id ?? '',
          lotId:      init.lotId ?? contextLot?.id ?? null,
          quantity:   1,
          reason:     'procedimento',
          justification: undefined,
          encounterId:  null,
          invoiceId:    null,
          notes:        null,
        } as FormValues;
      case 'ajuste':
        return {
          type:         'ajuste',
          productId:    init.productId ?? contextLot?.product_id ?? '',
          lotId:        init.lotId ?? contextLot?.id ?? null,
          delta:        1,
          reason:       'correcao',
          justification: '',
          notes:        null,
        } as FormValues;
      case 'transferencia':
        return {
          type:                  'transferencia',
          productId:             init.productId,
          lotId:                 init.lotId,
          quantity:              1,
          fromStorageLocationId: init.fromStorageLocationId ?? contextLot?.storage_location_id ?? '',
          toStorageLocationId:   '',
          notes:                 null,
        } as FormValues;
    }
  }, [initial, contextLot]);

  const {
    control,
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(registerMovementSchema as unknown as z.ZodType<FormValues>),
    defaultValues,
  });

  React.useEffect(() => {
    if (open) reset(defaultValues);
  }, [open, defaultValues, reset]);

  const type = watch('type') as MovementType;

  // ── Mutation ────────────────────────────────────────────────────────────
  const registerMut = trpc.supply.movements.register.useMutation({
    onSuccess: () => {
      void utils.supply.lots.list.invalidate();
      void utils.supply.stock.position.invalidate();
      onSaved();
      onClose();
    },
  });

  async function onSubmit(data: FormValues) {
    await registerMut.mutateAsync(data);
  }

  // ── Auxiliary queries for select options ────────────────────────────────
  const productsQuery = trpc.supply.products.list.useQuery(
    { limit: 100, page: 1, isActive: true },
    { staleTime: 60_000, enabled: open },
  );
  const locationsQuery = trpc.supply.storageLocations.list.useQuery(
    {},
    { staleTime: 60_000, enabled: open },
  );
  const suppliersQuery = trpc.supply.suppliers.list.useQuery(
    { limit: 100, page: 1 },
    { staleTime: 60_000, enabled: open && type === 'entrada' },
  );

  const products  = (productsQuery.data?.data ?? []) as ProductLite[];
  const locations = (locationsQuery.data ?? []) as LocationLite[];
  const suppliers = (suppliersQuery.data?.data ?? []) as SupplierLite[];

  // Product lots for exit/adjust — only when a product is selected.
  const productIdWatched = watch('productId' as const) as string | undefined;
  const productLotsQuery = trpc.supply.lots.list.useQuery(
    {
      productId: productIdWatched,
      includeConsumed: false,
      limit: 100,
      page: 1,
    },
    {
      staleTime: 10_000,
      enabled: open
        && !!productIdWatched
        && productIdWatched.length > 0
        && (type === 'saida' || type === 'ajuste'),
    },
  );
  const productLots = productLotsQuery.data?.data ?? [];

  const title =
    type === 'entrada'       ? 'Registrar Entrada' :
    type === 'saida'         ? 'Registrar Saída' :
    type === 'ajuste'        ? 'Registrar Ajuste' :
                               'Registrar Transferência';

  return (
    <DialogRoot open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <DialogContent
        className="sm:max-w-lg max-h-[90vh] overflow-y-auto"
        aria-labelledby="movement-modal-title"
      >
        <DialogHeader>
          <DialogTitle id="movement-modal-title">{title}</DialogTitle>
          {contextLot && (
            <p className="text-sm text-muted-foreground">
              {contextLot.product_name}{' · '}
              <span className="font-mono text-xs">{contextLot.lot_number}</span>
              {' · '}Saldo: {contextLot.quantity_current} {contextLot.product_unit}
            </p>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 py-2">
          {/* Type picker — only when not pre-locked by context */}
          {!contextLot && (
            <div className="space-y-1.5">
              <Label htmlFor="mv-type">Tipo de movimentação</Label>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      // Changing type resets the whole form with new defaults.
                      field.onChange(v);
                      reset({ ...defaultValues, type: v as MovementType } as FormValues);
                    }}
                  >
                    <SelectTrigger id="mv-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPE_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {TYPE_OPTION_LABELS[t as 'entrada' | 'saida' | 'ajuste' | 'transferencia']}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          {/* ── Fields by type ────────────────────────────────────────── */}
          {type === 'entrada' && (
            <EntryFields
              products={products}
              locations={locations}
              suppliers={suppliers}
              control={control}
              register={register}
              watch={watch}
              errors={errors}
              locked={!!initial && initial.type === 'entrada' && !!initial.productId}
            />
          )}

          {type === 'saida' && (
            <ExitFields
              products={products}
              productLots={productLots}
              control={control}
              register={register}
              errors={errors}
              locked={!!contextLot}
            />
          )}

          {type === 'ajuste' && (
            <AdjustFields
              products={products}
              productLots={productLots}
              control={control}
              register={register}
              errors={errors}
              locked={!!contextLot}
            />
          )}

          {type === 'transferencia' && (
            <TransferFields
              locations={locations}
              control={control}
              register={register}
              errors={errors}
              contextLot={contextLot ?? null}
            />
          )}

          {registerMut.isError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {registerMut.error.message}
            </p>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || registerMut.isPending}>
              {isSubmitting || registerMut.isPending ? 'Salvando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}

/* ── Sub-form types ───────────────────────────────────────────────────────── */

// react-hook-form types get noisy with discriminated unions; we type each
// section with `any` for control/register/watch but keep Zod as the source of
// truth for validation.
type AnyControl  = any; // eslint-disable-line @typescript-eslint/no-explicit-any
type AnyRegister = any; // eslint-disable-line @typescript-eslint/no-explicit-any
type AnyErrors   = any; // eslint-disable-line @typescript-eslint/no-explicit-any
type AnyWatch    = any; // eslint-disable-line @typescript-eslint/no-explicit-any

interface ProductLite    { id: string; name: string; unit: string; sku: string | null }
interface LocationLite   { id: string; name: string }
interface SupplierLite   { id: string; name: string }
interface LotLite        { id: string; lot_number: string; expiry_date: string | null; quantity_current: number }

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive" role="alert">{message}</p>;
}

function ProductSelect({
  control, products, locked, name = 'productId',
}: {
  control: AnyControl; products: ProductLite[]; locked: boolean; name?: string;
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Select value={field.value ?? ''} onValueChange={field.onChange} disabled={locked}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o produto" />
          </SelectTrigger>
          <SelectContent>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}{p.sku ? ` · ${p.sku}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
}

function LocationSelect({
  control, locations, name, placeholder,
}: {
  control: AnyControl; locations: LocationLite[]; name: string; placeholder: string;
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Select
          value={field.value ?? ''}
          onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— não definir —</SelectItem>
            {locations.map((l) => (
              <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
}

/* ── Entry fields ─────────────────────────────────────────────────────────── */

function EntryFields({
  products, locations, suppliers, control, register, watch, errors, locked,
}: {
  products: ProductLite[]; locations: LocationLite[]; suppliers: SupplierLite[];
  control: AnyControl; register: AnyRegister; watch: AnyWatch; errors: AnyErrors;
  locked: boolean;
}) {
  const acceptExpired = watch('acceptExpired');
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Produto *</Label>
        <ProductSelect control={control} products={products} locked={locked} />
        <FieldError message={errors.productId?.message} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="mv-lot-number">Lote *</Label>
          <Input id="mv-lot-number" {...register('lotNumber')} placeholder="ex: LT2026-0042" />
          <FieldError message={errors.lotNumber?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mv-batch">Batch (opcional)</Label>
          <Input id="mv-batch" {...register('batchNumber')} placeholder="ex: BT42" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="mv-qty">Quantidade *</Label>
          <Input
            id="mv-qty" type="number" step="any" min="0"
            {...register('quantity', { valueAsNumber: true })}
          />
          <FieldError message={errors.quantity?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mv-cost">Custo unitário *</Label>
          <Input
            id="mv-cost" type="number" step="any" min="0"
            {...register('unitCost', { valueAsNumber: true })}
          />
          <FieldError message={errors.unitCost?.message} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="mv-expiry">Validade</Label>
          <Input id="mv-expiry" type="date" {...register('expiryDate')} />
          <FieldError message={errors.expiryDate?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mv-manufactured">Fabricação</Label>
          <Input id="mv-manufactured" type="date" {...register('manufacturedDate')} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Fornecedor</Label>
        <Controller
          name="supplierId"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value ?? ''}
              onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}
            >
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— nenhum —</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Local de armazenamento</Label>
        <LocationSelect
          control={control}
          locations={locations}
          name="storageLocationId"
          placeholder="Selecionar local"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Motivo</Label>
        <Controller
          name="reason"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ENTRADA_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{MOVEMENT_REASON_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2">
        <Controller
          name="acceptExpired"
          control={control}
          render={({ field }) => (
            <Checkbox
              id="mv-accept-expired"
              checked={!!field.value}
              onCheckedChange={(v: boolean | 'indeterminate') => field.onChange(v === true)}
            />
          )}
        />
        <div className="flex-1">
          <Label htmlFor="mv-accept-expired" className="text-sm">
            Aceitar lote com validade no passado
          </Label>
          {acceptExpired && (
            <div className="mt-2 space-y-1.5">
              <Textarea
                rows={2}
                placeholder={`Justificativa (min ${MIN_JUSTIFICATION_LENGTH} caracteres)`}
                {...register('acceptExpiredReason')}
              />
              <FieldError message={errors.acceptExpiredReason?.message} />
            </div>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mv-notes">Observações</Label>
        <Textarea id="mv-notes" rows={2} {...register('notes')} />
      </div>
    </div>
  );
}

/* ── Exit fields ──────────────────────────────────────────────────────────── */

function ExitFields({
  products, productLots, control, register, errors, locked,
}: {
  products: ProductLite[]; productLots: LotLite[];
  control: AnyControl; register: AnyRegister; errors: AnyErrors; locked: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Produto *</Label>
        <ProductSelect control={control} products={products} locked={locked} />
        <FieldError message={errors.productId?.message} />
      </div>

      <div className="space-y-1.5">
        <Label>Lote específico (opcional — FEFO se vazio)</Label>
        <Controller
          name="lotId"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value ?? ''}
              disabled={locked}
              onValueChange={(v) => field.onChange(v === '__fefo__' ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="FEFO — usar lote com validade mais próxima" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__fefo__">FEFO — automático</SelectItem>
                {productLots.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.lot_number}
                    {l.expiry_date ? ` · venc. ${l.expiry_date}` : ''}
                    {' · saldo '}{l.quantity_current}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mv-qty">Quantidade *</Label>
        <Input
          id="mv-qty" type="number" step="any" min="0"
          {...register('quantity', { valueAsNumber: true })}
        />
        <FieldError message={errors.quantity?.message} />
      </div>

      <div className="space-y-1.5">
        <Label>Motivo</Label>
        <Controller
          name="reason"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SAIDA_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{MOVEMENT_REASON_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mv-justification">
          Justificativa (min {MIN_JUSTIFICATION_LENGTH} caracteres se perda/descarte)
        </Label>
        <Textarea id="mv-justification" rows={2} {...register('justification')} />
        <FieldError message={errors.justification?.message} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mv-notes">Observações</Label>
        <Textarea id="mv-notes" rows={2} {...register('notes')} />
      </div>
    </div>
  );
}

/* ── Adjust fields ────────────────────────────────────────────────────────── */

function AdjustFields({
  products, productLots, control, register, errors, locked,
}: {
  products: ProductLite[]; productLots: LotLite[];
  control: AnyControl; register: AnyRegister; errors: AnyErrors; locked: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Produto *</Label>
        <ProductSelect control={control} products={products} locked={locked} />
        <FieldError message={errors.productId?.message} />
      </div>

      <div className="space-y-1.5">
        <Label>Lote (opcional — aplica ao mais recente se vazio)</Label>
        <Controller
          name="lotId"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value ?? ''}
              disabled={locked}
              onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}
            >
              <SelectTrigger><SelectValue placeholder="— automático —" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— automático —</SelectItem>
                {productLots.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.lot_number} · saldo {l.quantity_current}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mv-delta">Delta (positivo adiciona, negativo remove) *</Label>
        <Input
          id="mv-delta" type="number" step="any"
          placeholder="ex: 5 ou -3"
          {...register('delta', { valueAsNumber: true })}
        />
        <FieldError message={errors.delta?.message} />
      </div>

      <div className="space-y-1.5">
        <Label>Motivo</Label>
        <Controller
          name="reason"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {AJUSTE_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{MOVEMENT_REASON_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mv-justification">
          Justificativa * (min {MIN_JUSTIFICATION_LENGTH} caracteres)
        </Label>
        <Textarea id="mv-justification" rows={2} {...register('justification')} />
        <FieldError message={errors.justification?.message} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mv-notes">Observações</Label>
        <Textarea id="mv-notes" rows={2} {...register('notes')} />
      </div>
    </div>
  );
}

/* ── Transfer fields ──────────────────────────────────────────────────────── */

function TransferFields({
  locations, control, register, errors, contextLot,
}: {
  locations: LocationLite[];
  control: AnyControl; register: AnyRegister; errors: AnyErrors;
  contextLot: LotRow | null;
}) {
  return (
    <div className="space-y-3">
      {contextLot && (
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <div className="font-medium">{contextLot.product_name}</div>
          <div className="text-xs text-muted-foreground">
            Lote <span className="font-mono">{contextLot.lot_number}</span>
            {' · saldo '}{contextLot.quantity_current} {contextLot.product_unit}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="mv-qty">Quantidade a transferir *</Label>
        <Input
          id="mv-qty" type="number" step="any" min="0"
          {...register('quantity', { valueAsNumber: true })}
        />
        <FieldError message={errors.quantity?.message} />
      </div>

      <div className="space-y-1.5">
        <Label>Origem *</Label>
        <Controller
          name="fromStorageLocationId"
          control={control}
          render={({ field }) => (
            <Select value={field.value ?? ''} onValueChange={field.onChange}>
              <SelectTrigger><SelectValue placeholder="Local de origem" /></SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FieldError message={errors.fromStorageLocationId?.message} />
      </div>

      <div className="space-y-1.5">
        <Label>Destino *</Label>
        <Controller
          name="toStorageLocationId"
          control={control}
          render={({ field }) => (
            <Select value={field.value ?? ''} onValueChange={field.onChange}>
              <SelectTrigger><SelectValue placeholder="Local de destino" /></SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FieldError message={errors.toStorageLocationId?.message} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mv-notes">Observações</Label>
        <Textarea id="mv-notes" rows={2} {...register('notes')} />
      </div>
    </div>
  );
}
