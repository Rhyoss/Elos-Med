'use client';

import * as React from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Label, SelectRoot, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Switch, Textarea,
} from '@dermaos/ui';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createStorageLocationSchema,
  STORAGE_TYPE_LABELS,
  STORAGE_TYPES,
  REFRIGERATED_STORAGE_TYPES,
  type CreateStorageLocationInput,
} from '@dermaos/shared';
import { trpc } from '@/lib/trpc-provider';

type FormData = CreateStorageLocationInput;

interface StorageLocationModalProps {
  open:    boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function StorageLocationModal({ open, onClose, onSaved }: StorageLocationModalProps) {
  const utils = trpc.useUtils();

  const createMutation = trpc.supply.storageLocations.create.useMutation({
    onSuccess: () => {
      void utils.supply.storageLocations.list.invalidate();
      onSaved();
      onClose();
    },
  });

  const {
    register, handleSubmit, control, watch, reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(createStorageLocationSchema),
    defaultValues: { name: '', type: 'temperatura_ambiente', description: '', minTempC: null, maxTempC: null },
  });

  React.useEffect(() => {
    if (!open) reset({ name: '', type: 'temperatura_ambiente', description: '', minTempC: null, maxTempC: null });
  }, [open, reset]);

  const selectedType = watch('type');
  const isRefrigerated = (REFRIGERATED_STORAGE_TYPES as ReadonlyArray<string>).includes(selectedType);

  async function onSubmit(data: FormData) {
    await createMutation.mutateAsync(data);
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md" aria-labelledby="storage-modal-title">
        <DialogHeader>
          <DialogTitle id="storage-modal-title">Novo Local de Armazenamento</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-4 py-4 px-6">
            {/* Nome */}
            <div className="space-y-1.5">
              <Label htmlFor="sl-name">
                Nome <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <input
                {...register('name')}
                id="sl-name"
                type="text"
                placeholder="Ex: Geladeira Recepção 1"
                maxLength={100}
                className={inputClass}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'sl-name-error' : undefined}
              />
              {errors.name && (
                <p id="sl-name-error" role="alert" className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            {/* Tipo */}
            <div className="space-y-1.5">
              <Label htmlFor="sl-type">
                Tipo <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <SelectRoot value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="sl-type" aria-label="Tipo de local">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STORAGE_TYPES.map(t => (
                        <SelectItem key={t} value={t}>{STORAGE_TYPE_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </SelectRoot>
                )}
              />
              {isRefrigerated && (
                <p className="flex items-center gap-1.5 text-xs text-blue-600">
                  <span aria-hidden="true">❄</span>
                  Suporta cadeia fria
                </p>
              )}
            </div>

            {/* Temperatura (somente para refrigerados) */}
            {isRefrigerated && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="sl-min-temp">Temp. Mín. (°C)</Label>
                  <input
                    {...register('minTempC', { valueAsNumber: true })}
                    id="sl-min-temp"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 2"
                    className={inputClass}
                    aria-invalid={!!errors.minTempC}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sl-max-temp">Temp. Máx. (°C)</Label>
                  <input
                    {...register('maxTempC', { valueAsNumber: true })}
                    id="sl-max-temp"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 8"
                    className={inputClass}
                    aria-invalid={!!errors.maxTempC}
                  />
                  {errors.maxTempC && (
                    <p role="alert" className="text-xs text-destructive">{errors.maxTempC.message}</p>
                  )}
                </div>
              </div>
            )}

            {/* Descrição */}
            <div className="space-y-1.5">
              <Label htmlFor="sl-desc">Descrição</Label>
              <Textarea
                {...register('description')}
                id="sl-desc"
                placeholder="Descrição ou localização física (opcional)"
                rows={2}
                className="resize-none"
                maxLength={500}
              />
            </div>

            {createMutation.isError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {createMutation.error.message}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || createMutation.isPending}>
              {isSubmitting || createMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const inputClass =
  'h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
