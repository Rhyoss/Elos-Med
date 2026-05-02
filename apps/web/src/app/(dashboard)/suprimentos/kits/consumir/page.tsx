'use client';

import * as React from 'react';
import {
  Button, Badge, Checkbox,
  SelectRoot, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@dermaos/ui';
import { WifiOff, Check, AlertTriangle, ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc-provider';
import type {
  ConsumeKitInput, ConsumeKitResult,
  KitAvailabilityResult, KitAvailabilityItemResult,
} from '@dermaos/shared';

import { SuprimentosTabs } from '../../_components/suprimentos-tabs';
import * as OfflineQueue from './offline-queue';

type Step = 1 | 2 | 3 | 4;

interface AgendaItem {
  appointment_id: string;
  scheduled_at:   string;
  status:         string;
  patient_id:     string;
  patient_name:   string;
  service_id:     string | null;
  service_name:   string | null;
  kit_id:         string | null;
  kit_name:       string | null;
  kit_version:    number | null;
  kit_items_count: number | null;
  encounter_id:   string | null;
}

interface ItemState {
  productId: string;
  productName: string;
  productUnit: string;
  isOptional: boolean;
  quantityRequired: number;
  suggestedLot:  {
    lotId: string; lotNumber: string; expiryDate: string | null;
    quantityFromLot: number; quantityAvailable: number;
  } | null;
  availableLots: Array<{
    lotId: string; lotNumber: string; expiryDate: string | null; quantityAvailable: number;
  }>;
  status: 'disponivel' | 'insuficiente' | 'indisponivel';
  selectedLotId: string | null;
  skipped: boolean;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
}

export default function ConsumirKitPage() {
  const [step, setStep] = React.useState<Step>(1);
  const [online, setOnline] = React.useState<boolean>(OfflineQueue.isOnline());
  const [pendingCount, setPendingCount] = React.useState(0);
  const [confirmed, setConfirmed] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitResult, setSubmitResult] = React.useState<ConsumeKitResult | null>(null);
  const [savedOffline, setSavedOffline] = React.useState(false);

  React.useEffect(() => {
    const off = OfflineQueue.onConnectivityChange(setOnline);
    void OfflineQueue.listPending().then((q) => setPendingCount(q.length));
    return off;
  }, []);

  // Step 1 — agenda do dia
  const agendaQ = trpc.supply.consumption.todayAgenda.useQuery({}, { staleTime: 30_000 });
  const [selectedAppt, setSelectedAppt] = React.useState<AgendaItem | null>(null);

  // Step 2 — availability preview
  const availabilityQ = trpc.supply.kits.availability.useQuery(
    { kitId: selectedAppt?.kit_id ?? '' },
    { enabled: !!selectedAppt?.kit_id && step >= 2, staleTime: 15_000 },
  );

  const [items, setItems] = React.useState<ItemState[]>([]);

  React.useEffect(() => {
    if (step !== 2 || !availabilityQ.data) return;
    const next: ItemState[] = availabilityQ.data.items.map((it: KitAvailabilityItemResult) => ({
      productId:        it.productId,
      productName:      it.productName,
      productUnit:      it.productUnit,
      isOptional:       it.isOptional,
      quantityRequired: it.quantityRequired,
      suggestedLot:     it.suggestedLots[0] ?? null,
      availableLots:    it.suggestedLots.map((l) => ({
        lotId: l.lotId, lotNumber: l.lotNumber,
        expiryDate: l.expiryDate, quantityAvailable: l.quantityAvailable,
      })),
      status:           it.status,
      selectedLotId:    it.suggestedLots[0]?.lotId ?? null,
      skipped:          false,
    }));
    setItems(next);
  }, [step, availabilityQ.data]);

  const consumeMut = trpc.supply.consumption.consume.useMutation();

  function buildPayload(): ConsumeKitInput | null {
    if (!selectedAppt?.kit_id || !selectedAppt.patient_id) return null;
    const idempotencyKey = selectedAppt.encounter_id
      ? `encounter:${selectedAppt.encounter_id}`
      : `manual:${selectedAppt.appointment_id}:${Date.now()}`;
    return {
      kitId:       selectedAppt.kit_id,
      patientId:   selectedAppt.patient_id,
      encounterId: selectedAppt.encounter_id ?? null,
      protocolSessionId: null,
      source:      selectedAppt.encounter_id ? 'encounter' : 'manual',
      idempotencyKey,
      confirmed:   true as const,
      overrides:   items.map((it) => ({
        productId: it.productId,
        lotId:     it.selectedLotId ?? null,
        skipped:   it.skipped,
      })),
      allowPartial: true,
    };
  }

  async function handleSubmit() {
    const payload = buildPayload();
    if (!payload) return;
    setSubmitError(null);

    if (!online) {
      await OfflineQueue.enqueue(payload);
      setSavedOffline(true);
      setPendingCount((n) => n + 1);
      setStep(4);
      return;
    }

    try {
      const result = await consumeMut.mutateAsync(payload);
      setSubmitResult(result);
      setStep(4);
    } catch (err: any) {
      // Em caso de erro de rede, salva offline também
      if (err?.message?.includes('fetch') || err?.message?.includes('NetworkError')) {
        await OfflineQueue.enqueue(payload);
        setSavedOffline(true);
        setPendingCount((n) => n + 1);
        setStep(4);
      } else {
        setSubmitError(err?.message ?? 'Erro ao registrar consumo');
      }
    }
  }

  async function syncOffline() {
    const pending = await OfflineQueue.listPending();
    for (const entry of pending) {
      try {
        await consumeMut.mutateAsync(entry.payload);
        await OfflineQueue.remove(entry.id);
      } catch (err: any) {
        await OfflineQueue.markAttempt(entry.id, err?.message ?? 'unknown');
      }
    }
    const q = await OfflineQueue.listPending();
    setPendingCount(q.length);
  }

  const agendaItems = (agendaQ.data?.data ?? []) as AgendaItem[];

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 max-w-3xl mx-auto">
      <SuprimentosTabs />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Registrar Consumo</h1>
        <div className="flex items-center gap-2">
          {!online && (
            <Badge variant="warning" aria-live="polite">
              <WifiOff className="mr-1 h-3 w-3 inline" /> Offline
            </Badge>
          )}
          {pendingCount > 0 && (
            <Button variant="outline" size="sm" onClick={syncOffline} disabled={!online}>
              <RotateCw className="mr-1 h-4 w-4" />
              Sincronizar ({pendingCount})
            </Button>
          )}
        </div>
      </div>

      {/* Stepper */}
      <ol className="flex items-center gap-2 text-xs font-medium">
        {[1, 2, 3, 4].map((n) => (
          <li key={n} className={`flex items-center gap-1 ${step >= n ? 'text-foreground' : 'text-muted-foreground'}`}>
            <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs
              ${step >= n ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              {n}
            </span>
            <span className="hidden sm:inline">
              {n === 1 ? 'Agenda' : n === 2 ? 'Lotes' : n === 3 ? 'Confirmar' : 'Resultado'}
            </span>
            {n < 4 && <ChevronRight className="h-3 w-3" />}
          </li>
        ))}
      </ol>

      {/* Step 1 */}
      {step === 1 && (
        <section className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Selecione o procedimento do dia que será consumido:
          </p>
          {agendaQ.isLoading && <p className="text-sm">Carregando agenda…</p>}
          {!agendaQ.isLoading && agendaItems.length === 0 && (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhum procedimento agendado para hoje.
            </div>
          )}
          <div className="space-y-2">
            {agendaItems.map((a) => (
              <button
                key={a.appointment_id}
                type="button"
                onClick={() => setSelectedAppt(a)}
                className={`w-full text-left rounded-md border p-3 hover:bg-muted/40 ${
                  selectedAppt?.appointment_id === a.appointment_id ? 'border-primary' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{a.patient_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(a.scheduled_at)} · {a.service_name ?? 'Sem procedimento'}
                    </p>
                  </div>
                  {a.kit_id ? (
                    <Badge variant="success">Kit vinculado</Badge>
                  ) : (
                    <Badge variant="neutral">Sem kit</Badge>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <Button
              disabled={!selectedAppt || !selectedAppt.kit_id}
              onClick={() => setStep(2)}
            >
              Avançar <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>

          {selectedAppt && !selectedAppt.kit_id && (
            <p className="text-sm text-warning-700">
              Este procedimento não tem kit vinculado. Configure o kit em /suprimentos/kits.
            </p>
          )}
        </section>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <section className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Lotes sugeridos via FEFO. Você pode trocar de lote ou marcar itens opcionais como
            não utilizados.
          </p>

          {availabilityQ.isLoading && <p className="text-sm">Carregando disponibilidade…</p>}

          <div className="space-y-2">
            {items.map((it, idx) => (
              <div
                key={it.productId}
                className={`rounded-md border p-3 ${
                  it.status === 'indisponivel' && !it.isOptional ? 'border-danger-300 bg-danger-50' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-medium flex items-center gap-2">
                      {it.productName}
                      {it.isOptional && <Badge variant="neutral">Opcional</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Qtd: {it.quantityRequired} {it.productUnit}
                    </p>
                  </div>
                  <div>
                    {it.status === 'disponivel' && <Badge variant="success">Disponível</Badge>}
                    {it.status === 'insuficiente' && <Badge variant="warning">Insuficiente</Badge>}
                    {it.status === 'indisponivel' && <Badge variant="danger">Sem estoque</Badge>}
                  </div>
                </div>

                {it.status !== 'indisponivel' && !it.skipped && (
                  <div className="mt-2">
                    <label className="text-xs text-muted-foreground">Lote</label>
                    <SelectRoot
                      value={it.selectedLotId ?? ''}
                      onValueChange={(v) => {
                        const next = [...items]; next[idx] = { ...next[idx]!, selectedLotId: v };
                        setItems(next);
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Escolher lote" />
                      </SelectTrigger>
                      <SelectContent>
                        {it.availableLots.map((l) => (
                          <SelectItem key={l.lotId} value={l.lotId}>
                            {l.lotNumber} · Vld: {formatDate(l.expiryDate)} · Qt: {l.quantityAvailable}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </SelectRoot>
                  </div>
                )}

                {it.isOptional && (
                  <label className="mt-2 flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={it.skipped}
                      onCheckedChange={(v) => {
                        const next = [...items]; next[idx] = { ...next[idx]!, skipped: v === true };
                        setItems(next);
                      }}
                    />
                    Não utilizado neste procedimento
                  </label>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
            </Button>
            <Button onClick={() => setStep(3)}>
              Avançar <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </section>
      )}

      {/* Step 3 */}
      {step === 3 && selectedAppt && (
        <section className="space-y-3">
          <h2 className="text-base font-medium">Confirmação</h2>

          <div className="rounded-md border p-3 space-y-1 text-sm">
            <p><strong>Paciente:</strong> {selectedAppt.patient_name}</p>
            <p><strong>Procedimento:</strong> {selectedAppt.service_name ?? '—'}</p>
            <p><strong>Horário:</strong> {formatTime(selectedAppt.scheduled_at)}</p>
          </div>

          <div className="rounded-md border p-3 space-y-1.5 text-sm">
            <p className="font-medium">Itens que serão consumidos:</p>
            <ul className="space-y-1">
              {items.filter((it) => !it.skipped).map((it) => {
                const lot = it.availableLots.find((l) => l.lotId === it.selectedLotId);
                return (
                  <li key={it.productId} className="flex items-center justify-between">
                    <span>{it.productName} · {it.quantityRequired} {it.productUnit}</span>
                    <span className="text-xs text-muted-foreground">
                      Lote {lot?.lotNumber ?? '—'}
                      {it.status !== 'disponivel' && (
                        <Badge variant={it.status === 'insuficiente' ? 'warning' : 'danger'} className="ml-2">
                          {it.status === 'insuficiente' ? 'Parcial' : 'Sem estoque'}
                        </Badge>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
            {items.some((it) => it.skipped) && (
              <p className="text-xs text-muted-foreground pt-2">
                Itens não utilizados: {items.filter((it) => it.skipped).map((it) => it.productName).join(', ')}
              </p>
            )}
          </div>

          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} />
            <span>
              Confirmo que os itens e lotes acima foram efetivamente utilizados neste procedimento.
            </span>
          </label>

          {submitError && (
            <div className="rounded-md border border-danger-300 bg-danger-50 p-3 text-sm text-danger-700">
              {submitError}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
            </Button>
            <Button onClick={handleSubmit} disabled={!confirmed} isLoading={consumeMut.isPending}>
              Registrar Consumo
            </Button>
          </div>
        </section>
      )}

      {/* Step 4 */}
      {step === 4 && (
        <section className="space-y-3">
          {savedOffline ? (
            <div className="rounded-md border border-warning-300 bg-warning-50 p-4 text-sm">
              <p className="flex items-center gap-2 font-medium text-warning-900">
                <WifiOff className="h-4 w-4" /> Consumo salvo localmente
              </p>
              <p className="text-warning-800 mt-1">
                Será sincronizado assim que a conexão voltar. Fila local: {pendingCount} consumo(s).
              </p>
            </div>
          ) : submitResult ? (
            <div className={`rounded-md border p-4 text-sm ${
              submitResult.status === 'completed' ? 'border-success-300 bg-success-50'
              : submitResult.status === 'partial' ? 'border-warning-300 bg-warning-50'
              : 'border-muted'
            }`}>
              <p className="flex items-center gap-2 font-medium">
                {submitResult.status === 'completed' ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                {submitResult.status === 'completed'
                  ? `Consumo registrado com sucesso. ${submitResult.itemsConsumed} item(ns) processado(s).`
                  : submitResult.status === 'partial'
                  ? `Consumo parcial: ${submitResult.itemsConsumed} item(ns) registrado(s), ${submitResult.itemsPending} pendente(s).`
                  : 'Consumo registrado.'}
              </p>
              {submitResult.alreadyProcessed && (
                <p className="text-xs text-muted-foreground mt-2">
                  (Este consumo já havia sido registrado — mostrando estado persistido.)
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-md border border-danger-300 bg-danger-50 p-4 text-sm text-danger-700">
              Erro ao registrar consumo.
              <Button variant="outline" size="sm" className="ml-2" onClick={() => setStep(3)}>
                Tentar novamente
              </Button>
            </div>
          )}

          <div className="flex justify-between">
            <Link href="/suprimentos/kits" passHref>
              <Button variant="outline">Voltar aos Kits</Button>
            </Link>
            <Button onClick={() => {
              setStep(1); setSelectedAppt(null); setItems([]);
              setConfirmed(false); setSubmitError(null); setSubmitResult(null); setSavedOffline(false);
            }}>
              Registrar Novo Consumo
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
