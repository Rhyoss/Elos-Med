'use client';

import * as React from 'react';
import {
  Button, Input, Badge,
  DialogRoot, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@dermaos/ui';
import { Search, FileDown, ShieldAlert, Download } from 'lucide-react';
import { trpc } from '@/lib/trpc-provider';
import { useDebounce } from '@/lib/utils';
import { usePermission } from '@/lib/auth';
import type { TracebackRow } from '@dermaos/shared';

import { SuprimentosTabs } from '../_components/suprimentos-tabs';

type Mode = 'lot' | 'patient';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR');
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
}

export default function RastreabilidadePage() {
  const canView   = usePermission('traceability', 'read');
  const canRecall = usePermission('traceability', 'recall');
  const canExport = usePermission('traceability', 'export') || canRecall;

  const [mode, setMode] = React.useState<Mode>('lot');
  const [input, setInput] = React.useState('');
  const debouncedInput = useDebounce(input, 300);

  const [activeLotId, setActiveLotId] = React.useState<string | null>(null);
  const [activePatientId, setActivePatientId] = React.useState<string | null>(null);

  // Busca por lot number — resolve via backend via query
  const byLotQ = trpc.supply.traceability.byLot.useQuery(
    {
      lotNumber: mode === 'lot' && debouncedInput.length >= 2 ? debouncedInput : undefined,
      lotId:     activeLotId ?? undefined,
      limit:     50,
    },
    {
      enabled: canView && mode === 'lot' && (debouncedInput.length >= 2 || !!activeLotId),
      retry: false,
    },
  );

  // Busca paciente via patients.search (assume exists)
  const patientSearchQ = (trpc as any).patients?.search?.useQuery
    ? (trpc as any).patients.search.useQuery(
        { q: debouncedInput, limit: 8 },
        { enabled: mode === 'patient' && debouncedInput.length >= 3 },
      )
    : { data: { data: [] }, isLoading: false };

  const byPatientQ = trpc.supply.traceability.byPatient.useQuery(
    { patientId: activePatientId ?? '', limit: 50 },
    { enabled: canView && mode === 'patient' && !!activePatientId, retry: false },
  );

  const rows: TracebackRow[] = (
    mode === 'lot' ? byLotQ.data?.rows : byPatientQ.data?.rows
  ) ?? [];
  const total = (mode === 'lot' ? byLotQ.data?.total : byPatientQ.data?.total) ?? 0;
  const isLoading = mode === 'lot' ? byLotQ.isFetching : byPatientQ.isFetching;

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [generatedUrl, setGeneratedUrl] = React.useState<string | null>(null);
  const [generatedHash, setGeneratedHash] = React.useState<string | null>(null);
  const [generateError, setGenerateError] = React.useState<string | null>(null);

  const generateMut = trpc.supply.traceability.generateReport.useMutation({
    onSuccess: (r) => {
      setGeneratedUrl(r.downloadUrl);
      setGeneratedHash(r.sha256);
      setConfirmOpen(false);
    },
    onError: (err) => {
      setGenerateError(err.message ?? 'Falha ao gerar relatório');
      setConfirmOpen(false);
    },
  });

  function handleGenerate() {
    setGenerateError(null);
    setGeneratedUrl(null);
    if (mode === 'lot' && rows[0]?.lotId) {
      generateMut.mutate({ scope: 'by_lot', lotId: rows[0].lotId });
    } else if (mode === 'patient' && activePatientId) {
      generateMut.mutate({ scope: 'by_patient', patientId: activePatientId });
    }
  }

  if (!canView) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        <SuprimentosTabs />
        <p className="mt-4">Você não tem permissão para consultar rastreabilidade.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <SuprimentosTabs />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Rastreabilidade ANVISA</h1>
          <p className="text-sm text-muted-foreground">
            Consulte o uso bidirecional entre lotes e pacientes.
          </p>
        </div>
        {canExport && rows.length > 0 && (
          <Button size="sm" onClick={() => setConfirmOpen(true)}>
            <FileDown className="mr-1 h-4 w-4" />
            Gerar Relatório ANVISA
          </Button>
        )}
      </div>

      {!canRecall && (
        <div className="rounded-md border border-warning-200 bg-warning-50 p-3 text-xs text-warning-900 flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            Dados de paciente aparecem parcialmente mascarados. Para consultas de recall com dados
            completos, peça a um responsável com permissão &quot;traceability.recall&quot;.
          </p>
        </div>
      )}

      {/* Mode toggle */}
      <div className="inline-flex rounded-md border p-1 w-fit">
        <button
          type="button"
          className={`px-3 py-1.5 text-sm rounded ${mode === 'lot' ? 'bg-primary text-primary-foreground' : ''}`}
          onClick={() => { setMode('lot'); setInput(''); setActiveLotId(null); setActivePatientId(null); }}
        >
          Buscar por Lote
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 text-sm rounded ${mode === 'patient' ? 'bg-primary text-primary-foreground' : ''}`}
          onClick={() => { setMode('patient'); setInput(''); setActiveLotId(null); setActivePatientId(null); }}
        >
          Buscar por Paciente
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={mode === 'lot' ? 'Número do lote (min 2 chars)' : 'Nome ou telefone (min 3 chars)'}
          className="pl-8"
        />
      </div>

      {/* Patient picker */}
      {mode === 'patient' && debouncedInput.length >= 3 && !activePatientId && (
        <div className="border rounded-md divide-y max-w-md">
          {(patientSearchQ.data?.data ?? []).length === 0 && !patientSearchQ.isLoading && (
            <p className="p-3 text-sm text-muted-foreground">Nenhum paciente encontrado.</p>
          )}
          {(patientSearchQ.data?.data ?? []).map((p: any) => (
            <button
              key={p.id} type="button"
              onClick={() => setActivePatientId(p.id)}
              className="w-full text-left p-2 hover:bg-muted text-sm"
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!isLoading && rows.length === 0 && (debouncedInput.length >= 2 || activePatientId) && (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum registro de rastreabilidade encontrado.
        </div>
      )}

      {rows.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">
            {total} ocorrência{total !== 1 ? 's' : ''} encontrada{total !== 1 ? 's' : ''}
          </p>
          <ol className="space-y-2">
            {rows.map((r) => (
              <li key={r.traceId} className="rounded-md border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {formatDateTime(r.appliedAt)}
                      {r.procedureName && (
                        <span className="ml-2 text-muted-foreground">· {r.procedureName}</span>
                      )}
                    </p>
                    <p className="text-sm mt-1">
                      <strong>Paciente:</strong> {r.patientLabel}
                      {r.patientPhone && <span className="text-muted-foreground ml-2">({r.patientPhone})</span>}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Produto: {r.productName}
                      {r.productAnvisa && <span className="ml-2">· ANVISA {r.productAnvisa}</span>}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Lote: {r.lotNumber}
                      {r.expiryDate && <span className="ml-2">· Validade {formatDate(r.expiryDate)}</span>}
                      <span className="ml-2">· Qtd usada {r.quantityUsed}</span>
                    </p>
                    {r.providerName && (
                      <p className="text-xs text-muted-foreground mt-1">Responsável: {r.providerName}</p>
                    )}
                    {r.supplierName && (
                      <p className="text-xs text-muted-foreground">Fornecedor: {r.supplierName}</p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}

      {/* Generated PDF result */}
      {generatedUrl && (
        <div className="rounded-md border border-success-300 bg-success-50 p-3 text-sm">
          <p className="font-medium">Relatório gerado com sucesso.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Hash SHA-256: <code className="text-[11px]">{generatedHash}</code>
          </p>
          <a href={generatedUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-2 text-primary underline text-sm">
            <Download className="h-4 w-4" /> Baixar PDF
          </a>
        </div>
      )}

      {generateError && (
        <div className="rounded-md border border-danger-300 bg-danger-50 p-3 text-sm text-danger-700">
          {generateError}
          <Button variant="outline" size="sm" className="ml-2" onClick={() => { setGenerateError(null); setConfirmOpen(true); }}>
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Confirmation dialog */}
      <DialogRoot open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar geração do relatório</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4 text-sm text-muted-foreground">
            Este relatório contém dados sensíveis de pacientes. A geração será registrada em
            audit trail (quem gerou, quando, escopo).
            <br /><br />
            <strong>Confirma a geração?</strong>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGenerate} isLoading={generateMut.isPending}>
              Gerar Relatório
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </div>
  );
}
