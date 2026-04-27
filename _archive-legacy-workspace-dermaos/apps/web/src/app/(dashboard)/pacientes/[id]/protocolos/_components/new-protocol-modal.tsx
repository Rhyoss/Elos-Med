'use client';

import * as React from 'react';
import {
  Button,
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Textarea,
  useToast,
} from '@dermaos/ui';
import {
  PROTOCOL_TYPES,
  PROTOCOL_TYPE_LABELS,
  type ProtocolType,
} from '@dermaos/shared';
import { trpc } from '@/lib/trpc-provider';
import { cn } from '@/lib/utils';

interface NewProtocolModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId:  string;
  providerId: string;
}

export function NewProtocolModal({ open, onOpenChange, patientId, providerId }: NewProtocolModalProps) {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [type, setType] = React.useState<ProtocolType>('fototerapia');
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [totalSessions, setTotalSessions] = React.useState(6);
  const [intervalDays, setIntervalDays] = React.useState(14);

  const createMut = trpc.clinical.protocols.create.useMutation({
    onSuccess: () => {
      toast({ title: 'Protocolo criado' });
      void utils.clinical.protocols.listByPatient.invalidate({ patientId });
      onOpenChange(false);
      setName(''); setDescription('');
    },
    onError: (err) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo protocolo</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-2">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              {PROTOCOL_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    'rounded-md border p-2 text-left text-sm transition-colors',
                    type === t
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-border hover:border-primary-300',
                  )}
                  aria-pressed={type === t}
                >
                  {PROTOCOL_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">Nome *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex.: Fototerapia UVB — face"
              maxLength={200}
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">Descrição</label>
            <Textarea
              rows={3}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Total de sessões *</label>
              <Input
                type="number"
                min={1}
                max={100}
                value={String(totalSessions)}
                onChange={(e) => setTotalSessions(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Intervalo (dias) *</label>
              <Input
                type="number"
                min={1}
                max={365}
                value={String(intervalDays)}
                onChange={(e) => setIntervalDays(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 pb-6 pt-2 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => createMut.mutate({
              patientId, providerId, type, name,
              description: description || undefined,
              totalSessions, intervalDays,
            })}
            disabled={!name || totalSessions < 1 || intervalDays < 1 || createMut.isPending}
          >
            {createMut.isPending ? 'Criando…' : 'Criar protocolo'}
          </Button>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
