'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@dermaos/ui';
import { trpc } from '@/lib/trpc-provider';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@dermaos/shared';
import { formatBRL } from './format-brl';

const schema = z.object({
  patientId: z.string().uuid(),
  invoiceId: z.string().uuid(),
  method:    z.enum(PAYMENT_METHODS),
  amount:    z.number().int().positive('Valor deve ser maior que zero.'),
});
type FormValues = z.infer<typeof schema>;

interface PaymentModalProps {
  open:      boolean;
  onClose:   () => void;
  onSuccess: () => void;
}

export function PaymentModal({ open, onClose, onSuccess }: PaymentModalProps) {
  const utils   = trpc.useUtils();
  const [step, setStep] = React.useState<'form' | 'confirm'>('form');

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } =
    useForm<FormValues>({ resolver: zodResolver(schema) });

  const patientId = watch('patientId');
  const invoiceId = watch('invoiceId');

  // Busca pacientes (autocomplete simples — reutiliza endpoint existente)
  const patientsQuery = trpc.patients.list.useQuery(
    { page: 1, limit: 50 },
    { enabled: open, staleTime: 30_000 },
  );

  // Faturas pendentes do paciente
  const invoicesQuery = trpc.financial.invoices.list.useQuery(
    { patientId, status: 'emitida', limit: 50 },
    { enabled: !!patientId, staleTime: 5_000 },
  );

  const selectedInvoice = invoicesQuery.data?.data.find((i) => i.id === invoiceId);
  const balance = selectedInvoice ? selectedInvoice.amount_due : 0;

  // Preenche valor com saldo devedor ao selecionar fatura
  React.useEffect(() => {
    if (selectedInvoice) {
      setValue('amount', selectedInvoice.amount_due);
    }
  }, [selectedInvoice, setValue]);

  const registerMutation = trpc.financial.payments.register.useMutation({
    onSuccess() {
      utils.financial.caixa.getDia.invalidate();
      utils.financial.invoices.list.invalidate();
      reset();
      setStep('form');
      onSuccess();
    },
  });

  function onSubmit(data: FormValues) {
    if (step === 'form') {
      setStep('confirm');
      return;
    }
    registerMutation.mutate({
      invoiceId: data.invoiceId,
      method:    data.method,
      amount:    data.amount,
    });
  }

  function handleClose() {
    reset();
    setStep('form');
    onClose();
  }

  return (
    <DialogRoot open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {step === 'form' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="patientId">Paciente</Label>
                <Select onValueChange={(v) => { setValue('patientId', v); setValue('invoiceId', ''); }}>
                  <SelectTrigger id="patientId">
                    <SelectValue placeholder="Selecione o paciente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {patientsQuery.data?.data.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.patientId && <p className="text-xs text-destructive">{errors.patientId.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoiceId">Fatura pendente</Label>
                <Select
                  disabled={!patientId || invoicesQuery.isLoading}
                  onValueChange={(v) => setValue('invoiceId', v)}
                >
                  <SelectTrigger id="invoiceId">
                    <SelectValue placeholder={
                      !patientId ? 'Selecione o paciente primeiro'
                      : invoicesQuery.isLoading ? 'Carregando...'
                      : 'Selecione a fatura'
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {invoicesQuery.data?.data.map((inv) => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.invoice_number} — {formatBRL(inv.amount_due)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedInvoice && (
                  <p className="text-xs text-muted-foreground">
                    Saldo devedor: <strong>{formatBRL(balance)}</strong>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="method">Método de pagamento</Label>
                <Select onValueChange={(v) => setValue('method', v as any)}>
                  <SelectTrigger id="method">
                    <SelectValue placeholder="Selecione o método..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.method && <p className="text-xs text-destructive">{errors.method.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Valor (R$)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0,00"
                  {...register('amount', {
                    setValueAs: (v) => Math.round(parseFloat(v) * 100),
                  })}
                />
                {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
              </div>
            </>
          ) : (
            <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
              <p className="font-medium">Confirmar pagamento</p>
              <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                <span>Fatura:</span>
                <span className="font-mono">{selectedInvoice?.invoice_number}</span>
                <span>Método:</span>
                <span>{PAYMENT_METHOD_LABELS[watch('method')]}</span>
                <span>Valor:</span>
                <span className="font-semibold text-foreground">{formatBRL(watch('amount'))}</span>
              </div>
            </div>
          )}

          {registerMutation.error && (
            <p className="text-xs text-destructive">
              {registerMutation.error.message}
            </p>
          )}

          <DialogFooter>
            {step === 'confirm' && (
              <Button type="button" variant="outline" onClick={() => setStep('form')}>
                Voltar
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={registerMutation.isPending}>
              {step === 'form' ? 'Continuar' : registerMutation.isPending ? 'Registrando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}
