'use client';

import * as React from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Label, SelectRoot, SelectTrigger, SelectValue, SelectContent, SelectItem, Textarea,
} from '@dermaos/ui';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createCategorySchema, type CreateCategoryInput } from '@dermaos/shared';
import { trpc } from '@/lib/trpc-provider';

interface CategoryModalProps {
  open:    boolean;
  onClose: () => void;
  onSaved: () => void;
}

type FormData = CreateCategoryInput;

export function CategoryModal({ open, onClose, onSaved }: CategoryModalProps) {
  const utils = trpc.useUtils();

  const categoriesQuery = trpc.supply.categories.list.useQuery(
    {},
    { enabled: open, staleTime: 30_000 },
  );

  const createMutation = trpc.supply.categories.create.useMutation({
    onSuccess: () => {
      void utils.supply.categories.list.invalidate();
      onSaved();
      onClose();
    },
  });

  const {
    register, handleSubmit, control, watch, reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: { name: '', parentId: null, description: '' },
  });

  const selectedParentId = watch('parentId');

  React.useEffect(() => {
    if (!open) reset({ name: '', parentId: null, description: '' });
  }, [open, reset]);

  // Calcula nível do pai selecionado para bloquear se já no nível 2
  const parentDepth = React.useMemo(() => {
    if (!selectedParentId || !categoriesQuery.data) return 0;
    const parent = categoriesQuery.data.find(c => c.id === selectedParentId);
    return parent?.depth ?? 0;
  }, [selectedParentId, categoriesQuery.data]);

  // Monta breadcrumb preview da hierarquia
  const hierarchyPreview = React.useMemo(() => {
    if (!selectedParentId || !categoriesQuery.data) return null;
    const parts: string[] = [];
    let cur: (typeof categoriesQuery.data)[0] | undefined =
      categoriesQuery.data.find(c => c.id === selectedParentId);
    while (cur) {
      parts.unshift(cur.name);
      const parentId = cur.parent_id;
      cur = parentId ? categoriesQuery.data.find(c => c.id === parentId) : undefined;
    }
    return parts.join(' › ');
  }, [selectedParentId, categoriesQuery.data]);

  async function onSubmit(data: FormData) {
    await createMutation.mutateAsync(data);
  }

  // Categorias que podem ser pai (profundidade <= 1)
  const eligibleParents = (categoriesQuery.data ?? []).filter(c => (c.depth ?? 0) < 2);

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md" aria-labelledby="category-modal-title">
        <DialogHeader>
          <DialogTitle id="category-modal-title">Nova Categoria</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-4 py-2">
            {/* Nome */}
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">
                Nome <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <input
                {...register('name')}
                id="cat-name"
                type="text"
                placeholder="Ex: Toxinas Botulínicas"
                maxLength={100}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'cat-name-error' : undefined}
              />
              {errors.name && (
                <p id="cat-name-error" role="alert" className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            {/* Categoria pai */}
            <div className="space-y-1.5">
              <Label htmlFor="cat-parent">Categoria Pai (opcional)</Label>
              <Controller
                name="parentId"
                control={control}
                render={({ field }) => (
                  <SelectRoot
                    value={field.value ?? '__none__'}
                    onValueChange={v => field.onChange(v === '__none__' ? null : v)}
                  >
                    <SelectTrigger id="cat-parent" aria-label="Selecionar categoria pai">
                      <SelectValue placeholder="Nenhuma (nível raiz)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhuma (nível raiz)</SelectItem>
                      {eligibleParents.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {'  '.repeat(c.depth ?? 0)}{c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </SelectRoot>
                )}
              />
              {parentDepth >= 2 && (
                <p className="text-xs text-destructive" role="alert">
                  Esta categoria já está no nível máximo (3 níveis).
                </p>
              )}
              {hierarchyPreview && (
                <p className="text-xs text-muted-foreground">
                  Hierarquia: <span className="font-medium">{hierarchyPreview}</span>
                </p>
              )}
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <Label htmlFor="cat-desc">Descrição</Label>
              <Textarea
                {...register('description')}
                id="cat-desc"
                placeholder="Descrição da categoria (opcional)"
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
            <Button
              type="submit"
              disabled={isSubmitting || createMutation.isPending || parentDepth >= 2}
            >
              {isSubmitting || createMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
