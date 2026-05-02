'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Input,
  DialogRoot, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@dermaos/ui';
import {
  Upload, CheckCircle, AlertTriangle, XCircle, AlertCircle, Loader2,
} from 'lucide-react';
import { trpc } from '@/lib/trpc-provider';
import {
  receiveOrderSchema,
  type ReceiveOrderInput,
  type PurchaseOrder,
  type NfeParsedItem,
} from '@dermaos/shared';

interface ReceiptConferenceProps {
  order:     PurchaseOrder & { items: NonNullable<PurchaseOrder['items']> };
  onSuccess: (message: string) => void;
}

type FormValues = ReceiveOrderInput;

interface DivergenceInfo {
  pct:      number;
  absolute: number;
  level:    'ok' | 'warning' | 'critical';
}

function computeDivergence(
  ordered: number,
  received: number,
  tolerancePct: number,
  supervisorPct: number,
): DivergenceInfo {
  if (ordered === 0) return { pct: 0, absolute: 0, level: 'ok' };
  const abs = received - ordered;
  const pct = Math.abs(abs) / ordered * 100;
  return {
    pct,
    absolute: abs,
    level: pct > supervisorPct ? 'critical' : pct > tolerancePct ? 'warning' : 'ok',
  };
}

function DivBadge({ level, pct }: { level: DivergenceInfo['level']; pct: number }) {
  if (level === 'ok') return (
    <span className="inline-flex items-center gap-1 text-xs text-emerald-600" aria-label="Sem divergência">
      <CheckCircle className="size-3.5" aria-hidden="true" /> {pct.toFixed(1)}%
    </span>
  );
  if (level === 'warning') return (
    <span className="inline-flex items-center gap-1 text-xs text-yellow-600" aria-label={`Divergência ${pct.toFixed(1)}%`}>
      <AlertTriangle className="size-3.5" aria-hidden="true" /> {pct.toFixed(1)}%
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600" aria-label={`Divergência crítica ${pct.toFixed(1)}%`}>
      <XCircle className="size-3.5" aria-hidden="true" /> {pct.toFixed(1)}%
    </span>
  );
}

export function ReceiptConference({ order, onSuccess }: ReceiptConferenceProps) {
  const utils = trpc.useUtils();

  const settingsQuery = trpc.supply.purchaseOrders.settings.useQuery({}, { staleTime: 60_000 });
  const parseNfeMutation = trpc.supply.purchaseOrders.parseNfe.useMutation();
  const receiveMutation  = trpc.supply.purchaseOrders.receive.useMutation({
    onSuccess: (result) => {
      void utils.supply.purchaseOrders.list.invalidate();
      void utils.supply.purchaseOrders.get.invalidate({ orderId: order.id });
      onSuccess(
        `${result.lotsCreated} lote${result.lotsCreated !== 1 ? 's' : ''} criado${result.lotsCreated !== 1 ? 's' : ''}, ` +
        `${result.movementsCreated} item${result.movementsCreated !== 1 ? 'ns' : ''} recebido${result.movementsCreated !== 1 ? 's' : ''}.`,
      );
    },
  });

  const tolerancePct  = settingsQuery.data?.divergenceTolerancePct  ?? 10;
  const supervisorPct = settingsQuery.data?.divergenceSupervisorPct ?? 30;

  const [nfeItems,     setNfeItems]     = React.useState<NfeParsedItem[] | null>(null);
  const [nfeXml,       setNfeXml]       = React.useState<string | null>(null);
  const [nfeMeta,      setNfeMeta]      = React.useState<{
    numero?: string; serie?: string; cnpj?: string; data?: string;
  } | null>(null);
  const [parseError,   setParseError]   = React.useState<string | null>(null);
  const [cnpjWarning,  setCnpjWarning]  = React.useState(false);
  const [confirmOpen,  setConfirmOpen]  = React.useState(false);
  const [pendingType,  setPendingType]  = React.useState<'confirmar_total' | 'confirmar_parcial' | 'recusar' | null>(null);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(receiveOrderSchema),
    defaultValues: {
      orderId:             order.id,
      type:                'confirmar_total',
      supervisorApproved:  false,
      items: order.items.map((i) => ({
        purchaseOrderItemId: i.id,
        quantityReceived:    i.quantityOrdered - i.quantityReceived,
        lotNumber:           '',
        expiryDate:          undefined,
        temperatureCelsius:  undefined,
        storageLocationId:   undefined,
      })),
    },
  });

  const watchedItems = watch('items');
  const divergenceJustification = watch('divergenceJustification');
  const supervisorApproved = watch('supervisorApproved');
  const refusalReason = watch('refusalReason');

  const divergences = order.items.map((item, idx) => {
    const received = watchedItems[idx]?.quantityReceived ?? 0;
    const remaining = item.quantityOrdered - item.quantityReceived;
    return computeDivergence(remaining, received, tolerancePct, supervisorPct);
  });

  const hasDivergence         = divergences.some((d) => d.level !== 'ok');
  const hasCriticalDivergence = divergences.some((d) => d.level === 'critical');

  // Drag-and-drop NF-e upload
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  async function handleFile(file: File) {
    setParseError(null);
    if (file.size > 5 * 1024 * 1024) {
      setParseError('Arquivo muito grande. Tamanho máximo: 5 MB.');
      return;
    }
    const text = await file.text();
    setNfeXml(text);
    try {
      const result = await parseNfeMutation.mutateAsync({ xml: text });
      setNfeItems(result.itens);
      setNfeMeta({
        numero: result.numero,
        serie:  result.serie,
        cnpj:   result.cnpjEmitente,
        data:   result.dataEmissao,
      });
      setValue('nfeXml',    text);
      setValue('nfeNumber', result.numero);
      setValue('nfeSeries', result.serie);
      setValue('issuerCnpj', result.cnpjEmitente);
      setValue('issueDate',  result.dataEmissao);
    } catch (e) {
      setParseError(
        e instanceof Error ? e.message : 'Não foi possível ler o XML. Verifique se é uma NF-e válida.',
      );
      setNfeXml(null);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  function openConfirmDialog(type: 'confirmar_total' | 'confirmar_parcial' | 'recusar') {
    setPendingType(type);
    setValue('type', type);
    setConfirmOpen(true);
  }

  async function onConfirm() {
    setConfirmOpen(false);
    await handleSubmit(onSubmit)();
  }

  async function onSubmit(values: FormValues) {
    await receiveMutation.mutateAsync(values);
  }

  const totalReceived = watchedItems.reduce((s, i) => s + (i.quantityReceived ?? 0), 0);
  const totalOrdered  = order.items.reduce((s, i) => s + (i.quantityOrdered - i.quantityReceived), 0);
  const allReceived   = order.items.every((oi, idx) => {
    const remaining = oi.quantityOrdered - oi.quantityReceived;
    return (watchedItems[idx]?.quantityReceived ?? 0) >= remaining;
  });

  const receiveError = receiveMutation.error;

  return (
    <form onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-6" aria-label="Conferência de recebimento">
      {/* Upload NF-e */}
      <div
        className={`rounded-md border-2 border-dashed p-6 text-center transition-colors ${
          isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        role="region"
        aria-label="Área de upload de NF-e"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xml"
          className="sr-only"
          aria-label="Selecionar arquivo XML de NF-e"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
        />
        {parseNfeMutation.isPending ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="size-8 animate-spin" aria-hidden="true" />
            <p className="text-sm">Processando XML...</p>
          </div>
        ) : nfeMeta ? (
          <div className="flex flex-col items-center gap-1 text-sm">
            <CheckCircle className="size-6 text-emerald-600" aria-hidden="true" />
            <p className="font-medium text-emerald-700">NF-e carregada com sucesso</p>
            <p className="text-muted-foreground">
              NF {nfeMeta.numero}/{nfeMeta.serie} · CNPJ {nfeMeta.cnpj || '—'} · {nfeMeta.data}
            </p>
            <Button
              type="button" size="sm" variant="outline"
              onClick={() => { setNfeMeta(null); setNfeItems(null); setNfeXml(null); }}
              aria-label="Remover NF-e carregada"
            >
              Remover
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className="size-8 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">Arraste o XML da NF-e aqui</p>
              <p className="text-xs text-muted-foreground">ou</p>
            </div>
            <Button
              type="button" size="sm" variant="outline"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Selecionar arquivo XML de NF-e"
            >
              Selecionar arquivo
            </Button>
            <p className="text-xs text-muted-foreground">XML até 5 MB · Preenchimento manual disponível se necessário</p>
          </div>
        )}
        {parseError && (
          <p className="mt-2 text-xs text-red-600" role="alert">{parseError}</p>
        )}
      </div>

      {/* Campos manuais de NF-e (fallback quando parse não disponível) */}
      {!nfeMeta && (
        <details className="rounded-md border p-4">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
            Preencher dados da NF-e manualmente
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="nfeNumber" className="text-sm font-medium leading-none">Número da NF</label>
              <Input id="nfeNumber" {...register('nfeNumber')} placeholder="000001" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="nfeSeries" className="text-sm font-medium leading-none">Série</label>
              <Input id="nfeSeries" {...register('nfeSeries')} placeholder="1" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="issuerCnpj" className="text-sm font-medium leading-none">CNPJ Emitente</label>
              <Input id="issuerCnpj" {...register('issuerCnpj')} placeholder="00.000.000/0001-00" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="issueDate" className="text-sm font-medium leading-none">Data de Emissão</label>
              <Input id="issueDate" type="date" {...register('issueDate')} />
            </div>
          </div>
        </details>
      )}

      {/* Tabela de conferência */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Conferência Item a Item
        </h3>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm" aria-label="Tabela de conferência de itens">
            <thead>
              <tr className="border-b bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 text-left">Produto</th>
                <th className="px-3 py-2 text-right">Pedido</th>
                {nfeItems && <th className="px-3 py-2 text-right">NF-e</th>}
                <th className="px-3 py-2 text-right">Qtd Recebida</th>
                {nfeItems && <th className="px-3 py-2 text-center">Diverg.</th>}
                <th className="px-3 py-2 text-left">Lote *</th>
                <th className="px-3 py-2 text-left">Validade</th>
                <th className="px-3 py-2 text-left">Loc. Armazenamento</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((oi, idx) => {
                const nfeItem   = nfeItems?.[idx] ?? null;
                const div       = divergences[idx]!;
                const remaining = oi.quantityOrdered - oi.quantityReceived;
                const rowBg =
                  div.level === 'critical' ? 'bg-red-50' :
                  div.level === 'warning'  ? 'bg-yellow-50' : '';

                return (
                  <tr key={oi.id} className={`border-b ${rowBg}`}>
                    <td className="px-3 py-2">
                      <div className="font-medium">{oi.productName}</div>
                      {oi.sku && <div className="font-mono text-xs text-muted-foreground">{oi.sku}</div>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {remaining.toLocaleString('pt-BR')} {oi.unit}
                    </td>
                    {nfeItems && (
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {nfeItem
                          ? `${nfeItem.quantidade.toLocaleString('pt-BR')} (${nfeItem.codigo})`
                          : <span className="text-red-500" aria-label="Item não encontrado na NF-e">❌ não encontrado</span>}
                      </td>
                    )}
                    <td className="px-3 py-2 text-right">
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        className="w-24 text-right"
                        {...register(`items.${idx}.quantityReceived`, { valueAsNumber: true })}
                        aria-label={`Quantidade recebida de ${oi.productName}`}
                        aria-invalid={!!errors.items?.[idx]?.quantityReceived}
                      />
                    </td>
                    {nfeItems && (
                      <td className="px-3 py-2 text-center">
                        <DivBadge level={div.level} pct={div.pct} />
                      </td>
                    )}
                    <td className="px-3 py-2">
                      <Input
                        type="text"
                        placeholder="Nº lote"
                        className="w-28"
                        {...register(`items.${idx}.lotNumber`)}
                        aria-label={`Número de lote de ${oi.productName}`}
                        aria-invalid={!!errors.items?.[idx]?.lotNumber}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="date"
                        className="w-36"
                        {...register(`items.${idx}.expiryDate`)}
                        aria-label={`Validade de ${oi.productName}`}
                        aria-invalid={!!errors.items?.[idx]?.expiryDate}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="text"
                        placeholder="ID do local"
                        className="w-36"
                        {...register(`items.${idx}.storageLocationId`)}
                        aria-label={`Local de armazenamento de ${oi.productName}`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Justificativa de divergência */}
      {hasDivergence && (
        <div className="flex flex-col gap-1.5 rounded-md border border-yellow-200 bg-yellow-50 p-4">
          <label htmlFor="divergenceJustification" className="text-sm font-medium leading-none text-yellow-800">
            <AlertTriangle className="mr-1 inline size-4" aria-hidden="true" />
            Divergência detectada — justificativa obrigatória *
          </label>
          <textarea
            id="divergenceJustification"
            {...register('divergenceJustification')}
            rows={2}
            className="rounded-md border border-yellow-300 bg-white px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
            placeholder="Descreva o motivo da divergência (mínimo 10 caracteres)..."
            aria-required="true"
            aria-invalid={hasDivergence && !divergenceJustification?.trim()}
          />
          {errors.divergenceJustification && (
            <p className="text-xs text-red-600" role="alert">{errors.divergenceJustification.message}</p>
          )}
        </div>
      )}

      {/* Aprovação de supervisor para divergência crítica */}
      {hasCriticalDivergence && (
        <div className="flex items-center gap-3 rounded-md border border-red-200 bg-red-50 p-4">
          <input
            type="checkbox"
            id="supervisorApproved"
            {...register('supervisorApproved')}
            className="size-4 rounded border-red-300"
            aria-required="true"
          />
          <label htmlFor="supervisorApproved" className="text-sm text-red-700">
            Divergência acima de {supervisorPct}% confirmada e aprovada por supervisor
          </label>
        </div>
      )}

      {/* Erros globais */}
      {receiveError && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{receiveError.message}</span>
        </div>
      )}

      {/* Botões de ação */}
      <div className="flex items-center justify-end gap-3 border-t pt-4">
        <Button
          type="button"
          variant="destructive"
          onClick={() => openConfirmDialog('recusar')}
          disabled={receiveMutation.isPending}
          aria-label="Recusar recebimento"
        >
          <XCircle className="mr-2 size-4" aria-hidden="true" />
          Recusar
        </Button>
        {!allReceived && (
          <Button
            type="button"
            variant="outline"
            onClick={() => openConfirmDialog('confirmar_parcial')}
            disabled={receiveMutation.isPending || totalReceived === 0}
            aria-label="Confirmar recebimento parcial"
          >
            <AlertTriangle className="mr-2 size-4" aria-hidden="true" />
            Confirmar Parcial
          </Button>
        )}
        <Button
          type="button"
          onClick={() => openConfirmDialog('confirmar_total')}
          disabled={receiveMutation.isPending || !allReceived}
          aria-busy={receiveMutation.isPending}
          aria-label="Confirmar recebimento total"
        >
          {receiveMutation.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
          ) : (
            <CheckCircle className="mr-2 size-4" aria-hidden="true" />
          )}
          {receiveMutation.isPending ? 'Processando...' : 'Confirmar Total'}
        </Button>
      </div>

      {/* Dialog de confirmação */}
      <DialogRoot open={confirmOpen} onOpenChange={(o: boolean) => !o && setConfirmOpen(false)}>
        <DialogContent aria-label="Confirmar recebimento">
          <DialogHeader>
            <DialogTitle>
              {pendingType === 'recusar'
                ? 'Confirmar Recusa'
                : pendingType === 'confirmar_parcial'
                  ? 'Confirmar Recebimento Parcial'
                  : 'Confirmar Recebimento Total'}
            </DialogTitle>
          </DialogHeader>

          {pendingType === 'recusar' ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                Informe o motivo para a recusa desta entrega.
              </p>
              <label htmlFor="refusalReason" className="text-sm font-medium leading-none">Motivo *</label>
              <textarea
                id="refusalReason"
                {...register('refusalReason')}
                rows={3}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Descreva o motivo da recusa (mínimo 10 caracteres)..."
                aria-required="true"
              />
              {errors.refusalReason && (
                <p className="text-xs text-red-600" role="alert">{errors.refusalReason.message}</p>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              <p>
                {pendingType === 'confirmar_total'
                  ? `Confirmar o recebimento total de ${order.items.length} produto${order.items.length !== 1 ? 's' : ''}?`
                  : `Confirmar o recebimento parcial de ${order.items.length} produto${order.items.length !== 1 ? 's' : ''}? O pedido ficará com status "Parcialmente recebido".`}
              </p>
              <ul className="mt-2 space-y-1 text-xs">
                <li>• Lotes serão criados automaticamente</li>
                <li>• Movimentações de entrada serão registradas</li>
                <li>• Ação não pode ser desfeita</li>
              </ul>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button" variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={receiveMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant={pendingType === 'recusar' ? 'destructive' : 'default'}
              onClick={onConfirm}
              disabled={receiveMutation.isPending}
              aria-busy={receiveMutation.isPending}
            >
              {receiveMutation.isPending ? 'Processando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </form>
  );
}
