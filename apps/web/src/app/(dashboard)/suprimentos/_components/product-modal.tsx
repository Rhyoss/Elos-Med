'use client';

import * as React from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
  Button, Label, SelectRoot, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Switch, Tooltip, Textarea,
} from '@dermaos/ui';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createProductSchema,
  PRODUCT_UNITS,
  ANVISA_CONTROL_CLASSES,
  type CreateProductInput,
} from '@dermaos/shared';
import { trpc } from '@/lib/trpc-provider';
import { Info, Upload } from 'lucide-react';
import { useDebounce } from '@/lib/utils';

type FormData = CreateProductInput;

interface ProductModalProps {
  open:    boolean;
  onClose: () => void;
  onSaved: () => void;
}

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function ProductModal({ open, onClose, onSaved }: ProductModalProps) {
  const utils = trpc.useUtils();

  const categoriesQuery = trpc.supply.categories.list.useQuery({}, { enabled: open });
  const suppliersQuery  = trpc.supply.suppliers.list.useQuery({ limit: 100 }, { enabled: open });
  const locationsQuery  = trpc.supply.storageLocations.list.useQuery({}, { enabled: open });

  const createMutation = trpc.supply.products.create.useMutation({
    onSuccess: () => {
      void utils.supply.stock.position.invalidate();
      void utils.supply.products.list.invalidate();
      onSaved();
      onClose();
    },
  });

  const {
    register, handleSubmit, control, watch, reset, setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      name: '', sku: '', unit: 'unidade',
      isControlled: false, isColdChain: false,
      requiresPrescription: false, isConsumable: true,
      minStock: 0, substituteIds: [],
    },
  });

  React.useEffect(() => {
    if (!open) {
      reset();
      setPhotoPreview(null);
      setPhotoKey(null);
    }
  }, [open, reset]);

  const skuValue      = watch('sku');
  const isControlled  = watch('isControlled');
  const isColdChain   = watch('isColdChain');
  const unitCost      = watch('unitCost');
  const salePrice     = watch('salePrice');
  const debouncedSku  = useDebounce(skuValue, 500);

  // Verificação em tempo real de SKU duplicado
  const skuCheck = trpc.supply.products.checkSku.useQuery(
    { sku: debouncedSku },
    { enabled: debouncedSku.length >= 1, staleTime: 10_000 },
  );

  // Locais de armazenamento filtrados por cadeia fria
  const filteredLocations = React.useMemo(() => {
    const locs = locationsQuery.data ?? [];
    return isColdChain ? locs.filter(l => l.supports_refrigeration) : locs;
  }, [locationsQuery.data, isColdChain]);

  // Upload de foto
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null);
  const [photoKey, setPhotoKey]         = React.useState<string | null>(null);
  const [photoError, setPhotoError]     = React.useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError(null);

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setPhotoError('Tipo de arquivo não suportado. Use JPEG, PNG ou WebP.');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError('Imagem excede 5MB.');
      return;
    }

    // Preview
    const reader = new FileReader();
    reader.onload = e => setPhotoPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    // Upload
    setPhotoUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const res = await fetch('/api/supply/products/photo', {
        method: 'POST', body: formData, credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json() as { message?: string };
        throw new Error(body.message ?? 'Erro no upload');
      }
      const { objectKey } = await res.json() as { objectKey: string };
      setPhotoKey(objectKey);
      setValue('photoObjectKey', objectKey);
    } catch (err) {
      setPhotoError(`Falha no upload: ${(err as Error).message}`);
      setPhotoPreview(null);
      setPhotoKey(null);
    } finally {
      setPhotoUploading(false);
    }
  }

  async function onSubmit(data: FormData) {
    if (photoKey) data.photoObjectKey = photoKey;
    await createMutation.mutateAsync(data);
  }

  const priceWarning =
    unitCost != null && salePrice != null && salePrice > 0 && salePrice < unitCost;

  return (
    <Sheet open={open} onOpenChange={o => !o && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col overflow-y-auto sm:max-w-2xl"
        aria-labelledby="product-modal-title"
      >
        <SheetHeader className="shrink-0 border-b pb-4">
          <SheetTitle id="product-modal-title">Novo Produto</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-1 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto p-4">

            {/* ── Identificação ── */}
            <Section title="Identificação">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Nome */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="prod-name">Nome <Required /></Label>
                  <input
                    {...register('name')}
                    id="prod-name" type="text" maxLength={200}
                    placeholder="Nome do produto"
                    className={cx(inputClass, errors.name && errorClass)}
                    aria-invalid={!!errors.name}
                  />
                  {errors.name && <FieldError>{errors.name.message}</FieldError>}
                </div>

                {/* SKU */}
                <div className="space-y-1.5">
                  <Label htmlFor="prod-sku">SKU <Required /></Label>
                  <input
                    {...register('sku')}
                    id="prod-sku" type="text" maxLength={50}
                    placeholder="Ex: TOX-BTX-100U"
                    className={cx(inputClass, errors.sku && errorClass)}
                    aria-invalid={!!errors.sku}
                  />
                  {errors.sku && <FieldError>{errors.sku.message}</FieldError>}
                  {!errors.sku && skuCheck.data?.available === false && (
                    <FieldError>SKU já em uso por outro produto.</FieldError>
                  )}
                  {!errors.sku && skuCheck.data?.available === true && (
                    <p className="text-xs text-green-600">SKU disponível.</p>
                  )}
                </div>

                {/* Código de Barras */}
                <div className="space-y-1.5">
                  <Label htmlFor="prod-barcode">Código de Barras</Label>
                  <input
                    {...register('barcode')}
                    id="prod-barcode" type="text" maxLength={20}
                    placeholder="EAN-13, EAN-8 ou UPC-A"
                    className={inputClass}
                  />
                  {errors.barcode && <FieldError>{errors.barcode.message}</FieldError>}
                </div>

                {/* Marca */}
                <div className="space-y-1.5">
                  <Label htmlFor="prod-brand">Marca</Label>
                  <input
                    {...register('brand')}
                    id="prod-brand" type="text" maxLength={100}
                    placeholder="Fabricante/marca"
                    className={inputClass}
                  />
                </div>

                {/* Unidade */}
                <div className="space-y-1.5">
                  <Label htmlFor="prod-unit">Unidade <Required /></Label>
                  <Controller
                    name="unit"
                    control={control}
                    render={({ field }) => (
                      <SelectRoot value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="prod-unit"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PRODUCT_UNITS.map(u => (
                            <SelectItem key={u} value={u}>{u}</SelectItem>
                          ))}
                        </SelectContent>
                      </SelectRoot>
                    )}
                  />
                </div>

                {/* Categoria */}
                <div className="space-y-1.5">
                  <Label htmlFor="prod-cat">Categoria</Label>
                  <Controller
                    name="categoryId"
                    control={control}
                    render={({ field }) => (
                      <SelectRoot value={field.value ?? '__none__'} onValueChange={v => field.onChange(v === '__none__' ? null : v)}>
                        <SelectTrigger id="prod-cat"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Sem categoria</SelectItem>
                          {(categoriesQuery.data ?? []).map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              {'  '.repeat(c.depth ?? 0)}{c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </SelectRoot>
                    )}
                  />
                </div>

                {/* Fornecedor preferencial */}
                <div className="space-y-1.5">
                  <Label htmlFor="prod-sup">Fornecedor Preferencial</Label>
                  <Controller
                    name="preferredSupplierId"
                    control={control}
                    render={({ field }) => (
                      <SelectRoot value={field.value ?? '__none__'} onValueChange={v => field.onChange(v === '__none__' ? null : v)}>
                        <SelectTrigger id="prod-sup"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Nenhum</SelectItem>
                          {(suppliersQuery.data?.data ?? []).map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </SelectRoot>
                    )}
                  />
                </div>
              </div>
            </Section>

            {/* ── Parâmetros de estoque ── */}
            <Section title="Parâmetros de Estoque">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="prod-min">Mínimo</Label>
                    <FieldTip>Estoque mínimo aceitável antes de entrar em CRÍTICO.</FieldTip>
                  </div>
                  <input
                    {...register('minStock', { valueAsNumber: true })}
                    id="prod-min" type="number" min={0} step="any" placeholder="0"
                    className={inputClass}
                  />
                  {errors.minStock && <FieldError>{errors.minStock.message}</FieldError>}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="prod-reorder">Ponto de Pedido</Label>
                    <FieldTip>Nível de estoque que aciona o alerta ATENÇÃO.</FieldTip>
                  </div>
                  <input
                    {...register('reorderPoint', { valueAsNumber: true })}
                    id="prod-reorder" type="number" min={0} step="any" placeholder="—"
                    className={inputClass}
                  />
                  {errors.reorderPoint && <FieldError>{errors.reorderPoint.message}</FieldError>}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="prod-max">Máximo</Label>
                    <FieldTip>Capacidade máxima desejada de estoque.</FieldTip>
                  </div>
                  <input
                    {...register('maxStock', { valueAsNumber: true })}
                    id="prod-max" type="number" min={0} step="any" placeholder="—"
                    className={inputClass}
                  />
                  {errors.maxStock && <FieldError>{errors.maxStock.message}</FieldError>}
                </div>
              </div>
            </Section>

            {/* ── Preços ── */}
            <Section title="Preços">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="prod-cost">Custo Unitário (R$)</Label>
                  <input
                    {...register('unitCost', { valueAsNumber: true })}
                    id="prod-cost" type="number" min={0} step="0.01" placeholder="0,00"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prod-sale">Preço de Venda (R$)</Label>
                  <input
                    {...register('salePrice', { valueAsNumber: true })}
                    id="prod-sale" type="number" min={0} step="0.01" placeholder="0,00"
                    className={cx(inputClass, priceWarning && 'border-yellow-500')}
                    aria-describedby={priceWarning ? 'price-warn' : undefined}
                  />
                  {priceWarning && (
                    <p id="price-warn" className="text-xs text-yellow-600">
                      Preço de venda abaixo do custo.
                    </p>
                  )}
                </div>
              </div>
            </Section>

            {/* ── Regulatório ── */}
            <Section title="Regulatório">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="prod-anvisa">Registro ANVISA</Label>
                  <input
                    {...register('anvisaRegistration')}
                    id="prod-anvisa" type="text" maxLength={30}
                    placeholder="Ex: 1234567890123"
                    className={inputClass}
                  />
                  {errors.anvisaRegistration && (
                    <FieldError>{errors.anvisaRegistration.message}</FieldError>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-6">
                  {/* Controlado */}
                  <div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="prod-controlled" className="cursor-pointer">
                        Substância Controlada
                      </Label>
                      <Controller
                        name="isControlled"
                        control={control}
                        render={({ field }) => (
                          <Switch
                            id="prod-controlled"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            aria-label="Substância controlada"
                          />
                        )}
                      />
                    </div>
                    {isControlled && (
                      <div className="mt-2 space-y-1.5">
                        <Label htmlFor="prod-class">Classe de Controle <Required /></Label>
                        <Controller
                          name="controlClass"
                          control={control}
                          render={({ field }) => (
                            <SelectRoot value={field.value ?? ''} onValueChange={field.onChange}>
                              <SelectTrigger id="prod-class"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                              <SelectContent>
                                {ANVISA_CONTROL_CLASSES.map(c => (
                                  <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                              </SelectContent>
                            </SelectRoot>
                          )}
                        />
                        {errors.controlClass && <FieldError>{errors.controlClass.message}</FieldError>}
                      </div>
                    )}
                  </div>

                  {/* Cadeia fria */}
                  <div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="prod-cold" className="cursor-pointer">
                        Cadeia Fria ❄
                      </Label>
                      <Controller
                        name="isColdChain"
                        control={control}
                        render={({ field }) => (
                          <Switch
                            id="prod-cold"
                            checked={field.value}
                            onCheckedChange={v => {
                              field.onChange(v);
                              if (!v) setValue('defaultStorageLocationId', null);
                            }}
                            aria-label="Produto com cadeia fria"
                          />
                        )}
                      />
                    </div>
                    {isColdChain && (
                      <div className="mt-2 space-y-1.5">
                        <Label htmlFor="prod-storage">Local de Armazenamento Padrão</Label>
                        <Controller
                          name="defaultStorageLocationId"
                          control={control}
                          render={({ field }) => (
                            <SelectRoot value={field.value ?? '__none__'} onValueChange={v => field.onChange(v === '__none__' ? null : v)}>
                              <SelectTrigger id="prod-storage">
                                <SelectValue placeholder="Selecionar local..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Nenhum</SelectItem>
                                {filteredLocations.map(l => (
                                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </SelectRoot>
                          )}
                        />
                        {filteredLocations.length === 0 && (
                          <p className="text-xs text-yellow-600">
                            Nenhum local com refrigeração cadastrado.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Section>

            {/* ── Foto ── */}
            <Section title="Foto do Produto">
              <div className="flex items-start gap-4">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Preview da foto do produto"
                    className="h-24 w-24 rounded-lg object-cover border"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed bg-muted">
                    <Upload className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <Button
                    type="button" variant="outline" size="sm"
                    disabled={photoUploading}
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Selecionar foto do produto"
                  >
                    {photoUploading ? 'Enviando...' : 'Selecionar Foto'}
                  </Button>
                  <p className="text-xs text-muted-foreground">JPEG, PNG ou WebP · Máx. 5MB</p>
                  {photoError && <FieldError>{photoError}</FieldError>}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handlePhotoSelect}
                  aria-label="Upload de foto do produto"
                />
              </div>
            </Section>

            {createMutation.isError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {createMutation.error.message}
              </p>
            )}
          </div>

          <SheetFooter className="shrink-0 border-t p-4 gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || createMutation.isPending || photoUploading
                || skuCheck.data?.available === false}
            >
              {isSubmitting || createMutation.isPending ? 'Salvando...' : 'Cadastrar Produto'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide border-b pb-1">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Required() {
  return <span className="text-destructive" aria-hidden="true">*</span>;
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-destructive" role="alert">{children}</p>;
}

function FieldTip({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip content={children} className="max-w-xs text-xs">
      <button type="button" aria-label="Ajuda" className="text-muted-foreground">
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </Tooltip>
  );
}

function cx(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

const inputClass =
  'h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const errorClass = 'border-destructive';
