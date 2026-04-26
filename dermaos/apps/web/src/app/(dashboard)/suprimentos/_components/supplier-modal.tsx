'use client';

import * as React from 'react';
import {
  DialogRoot as Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Label,
} from '@dermaos/ui';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createSupplierSchema, isValidCNPJ, type CreateSupplierInput } from '@dermaos/shared';
import { trpc } from '@/lib/trpc-provider';
import { useDebounce } from '@/lib/utils';

type FormData = CreateSupplierInput;

interface SupplierModalProps {
  open:    boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function SupplierModal({ open, onClose, onSaved }: SupplierModalProps) {
  const utils = trpc.useUtils();

  const createMutation = trpc.supply.suppliers.create.useMutation({
    onSuccess: () => {
      void utils.supply.suppliers.list.invalidate();
      onSaved();
      onClose();
    },
  });

  const {
    register, handleSubmit, watch, reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(createSupplierSchema),
    defaultValues: {
      name: '', cnpj: '', contactName: '', phone: '', email: '',
      paymentTerms: '', leadTimeDays: undefined, address: {},
    },
  });

  React.useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const cnpjRaw = watch('cnpj');
  const debouncedCnpj = useDebounce(cnpjRaw, 500);

  // Verificação em tempo real de CNPJ duplicado
  const cnpjCheck = trpc.supply.suppliers.checkCnpj.useQuery(
    { cnpj: debouncedCnpj },
    {
      enabled: debouncedCnpj.replace(/\D/g, '').length === 14 && isValidCNPJ(debouncedCnpj),
      staleTime: 10_000,
    },
  );

  async function onSubmit(data: FormData) {
    await createMutation.mutateAsync(data);
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-lg" aria-labelledby="supplier-modal-title">
        <DialogHeader>
          <DialogTitle id="supplier-modal-title">Novo Fornecedor</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
            {/* Razão Social */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="sup-name">
                Razão Social <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <input
                {...register('name')}
                id="sup-name"
                type="text"
                placeholder="Razão social completa"
                maxLength={200}
                className={inputClass}
                aria-invalid={!!errors.name}
              />
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </div>

            {/* CNPJ */}
            <div className="space-y-1.5">
              <Label htmlFor="sup-cnpj">
                CNPJ <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <input
                {...register('cnpj')}
                id="sup-cnpj"
                type="text"
                placeholder="00.000.000/0000-00"
                maxLength={18}
                className={inputClass}
                aria-invalid={!!errors.cnpj}
                aria-describedby="sup-cnpj-status"
              />
              <div id="sup-cnpj-status">
                {errors.cnpj && <FieldError>{errors.cnpj.message}</FieldError>}
                {!errors.cnpj && cnpjCheck.data?.available === false && (
                  <p className="text-xs text-destructive" role="alert">
                    CNPJ já cadastrado neste tenant.
                  </p>
                )}
                {!errors.cnpj && cnpjCheck.data?.available === true && (
                  <p className="text-xs text-green-600">CNPJ disponível.</p>
                )}
              </div>
            </div>

            {/* Nome de contato */}
            <div className="space-y-1.5">
              <Label htmlFor="sup-contact">Contato</Label>
              <input
                {...register('contactName')}
                id="sup-contact"
                type="text"
                placeholder="Nome do contato"
                maxLength={100}
                className={inputClass}
              />
            </div>

            {/* Telefone */}
            <div className="space-y-1.5">
              <Label htmlFor="sup-phone">
                Telefone <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <input
                {...register('phone')}
                id="sup-phone"
                type="tel"
                placeholder="(11) 98765-4321"
                maxLength={15}
                className={inputClass}
                aria-invalid={!!errors.phone}
              />
              {errors.phone && <FieldError>{errors.phone.message}</FieldError>}
            </div>

            {/* E-mail */}
            <div className="space-y-1.5">
              <Label htmlFor="sup-email">
                E-mail <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <input
                {...register('email')}
                id="sup-email"
                type="email"
                placeholder="contato@fornecedor.com.br"
                maxLength={200}
                className={inputClass}
                aria-invalid={!!errors.email}
              />
              {errors.email && <FieldError>{errors.email.message}</FieldError>}
            </div>

            {/* Prazo de pagamento */}
            <div className="space-y-1.5">
              <Label htmlFor="sup-payment">Prazo de Pagamento</Label>
              <input
                {...register('paymentTerms')}
                id="sup-payment"
                type="text"
                placeholder="Ex: 30/60 dias"
                maxLength={200}
                className={inputClass}
              />
            </div>

            {/* Lead time */}
            <div className="space-y-1.5">
              <Label htmlFor="sup-lead">Lead Time (dias)</Label>
              <input
                {...register('leadTimeDays', { valueAsNumber: true })}
                id="sup-lead"
                type="number"
                min={0}
                max={365}
                placeholder="Ex: 7"
                className={inputClass}
                aria-invalid={!!errors.leadTimeDays}
              />
              {errors.leadTimeDays && <FieldError>{errors.leadTimeDays.message}</FieldError>}
            </div>

            {createMutation.isError && (
              <p className="col-span-full rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
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
              disabled={isSubmitting || createMutation.isPending || cnpjCheck.data?.available === false}
            >
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

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-destructive" role="alert">{children}</p>;
}
