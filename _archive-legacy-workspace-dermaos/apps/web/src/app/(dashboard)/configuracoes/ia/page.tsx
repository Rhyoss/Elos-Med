'use client';

import * as React from 'react';
import { Save, AlertTriangle, Bot, Info } from 'lucide-react';
import { trpc } from '@/lib/trpc-provider';
import { PageHeader } from '@dermaos/ui';

const AVAILABLE_MODELS = [
  { id: 'claude-sonnet-4-6',  label: 'Claude Sonnet 4.6 (Recomendado)' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (Rápido / Econômico)' },
  { id: 'claude-opus-4-7',   label: 'Claude Opus 4.7 (Máxima inteligência)' },
];

const TOKEN_WARN  = 3500;
const TOKEN_LIMIT = 4000;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function PromptDiff({
  oldText,
  newText,
}: { oldText: string; newText: string }) {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  return (
    <div className="rounded-md border bg-muted/30 p-3 font-mono text-xs">
      {newLines.map((line, i) => {
        const isNew     = !oldLines.includes(line);
        const isRemoved = oldLines[i] !== undefined && oldLines[i] !== line;
        return (
          <div
            key={i}
            className={
              isNew
                ? 'bg-green-50 text-green-700'
                : isRemoved
                  ? 'bg-red-50 text-red-600 line-through'
                  : ''
            }
          >
            {line || '\u00A0'}
          </div>
        );
      })}
    </div>
  );
}

export default function ConfiguracaoIAPage() {
  const utils = trpc.useUtils();

  const settingsQuery = trpc.settings.ai.get.useQuery();
  const historyQuery  = trpc.settings.ai.promptHistory.useQuery();

  const updateMut     = trpc.settings.ai.update.useMutation({
    onSuccess: () => utils.settings.ai.get.invalidate(),
  });
  const promptMut     = trpc.settings.ai.updatePrompt.useMutation({
    onSuccess: () => {
      utils.settings.ai.get.invalidate();
      utils.settings.ai.promptHistory.invalidate();
      setShowDiff(false);
    },
  });

  const data    = settingsQuery.data;
  const history = (historyQuery.data ?? []) as { id: string; prompt_text: string; token_estimate: number; created_at: string; created_by_name: string | null }[];

  const [auroraEnabled, setAuroraEnabled] = React.useState<boolean | undefined>(undefined);
  const [model, setModel]                 = React.useState<string | undefined>(undefined);
  const [promptText, setPromptText]       = React.useState('');
  const [showDiff, setShowDiff]           = React.useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (data) {
      if (auroraEnabled === undefined) setAuroraEnabled(data.auroraEnabled);
      if (model === undefined) setModel(data.preferredModel);
      if (!promptText && data.activePrompt) setPromptText(data.activePrompt.prompt_text ?? '');
    }
  }, [data]);

  const tokenCount = estimateTokens(promptText);
  const tokenWarning = tokenCount > TOKEN_WARN;
  const tokenError   = tokenCount > TOKEN_LIMIT;

  function handleAuroraToggle(val: boolean) {
    if (!val && !confirm('Desativar Aurora redirecionará todas as conversas ativas para a equipe. Confirmar?')) return;
    setAuroraEnabled(val);
    updateMut.mutate({ auroraEnabled: val });
  }

  const selectedHistoryPrompt = history.find((h) => h.id === selectedHistoryId)?.prompt_text ?? '';

  return (
    <div className="flex flex-col">
      <PageHeader
        title="IA & Automações"
        description="Configurações da Aurora — modelo, prompt e base de conhecimento"
      />

      <div className="grid gap-6 p-6 lg:grid-cols-2">
        {/* ── Toggle Aurora ──────────────────────────── */}
        <section className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bot className="h-5 w-5 text-primary" />
              <div>
                <h2 className="font-semibold">Aurora — Atendimento com IA</h2>
                <p className="text-xs text-muted-foreground">
                  {auroraEnabled ? 'Ativa — respondendo conversas automaticamente' : 'Inativa — conversas encaminhadas para a equipe'}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleAuroraToggle(!auroraEnabled)}
              disabled={updateMut.isPending || auroraEnabled === undefined}
              className={[
                'relative h-6 w-11 rounded-full transition-colors disabled:opacity-50',
                auroraEnabled ? 'bg-primary' : 'bg-muted',
              ].join(' ')}
            >
              <span
                className={[
                  'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                  auroraEnabled ? 'translate-x-5' : 'translate-x-0.5',
                ].join(' ')}
              />
            </button>
          </div>
        </section>

        {/* ── Modelo preferido ────────────────────────── */}
        <section className="rounded-lg border bg-card p-6">
          <h2 className="mb-3 font-semibold">Modelo de IA</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Alterações aplicam-se apenas a novas conversas.
          </p>
          <select
            value={model ?? ''}
            onChange={(e) => setModel(e.target.value)}
            className="w-full rounded-md border px-3 py-1.5 text-sm"
          >
            {AVAILABLE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
          <button
            onClick={() => model && updateMut.mutate({ preferredModel: model })}
            disabled={updateMut.isPending || model === data?.preferredModel}
            className="mt-3 flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {updateMut.isPending ? 'Salvando...' : 'Salvar modelo'}
          </button>
        </section>

        {/* ── System Prompt ───────────────────────────── */}
        <section className="rounded-lg border bg-card p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">System Prompt da Aurora</h2>
            <div className="flex items-center gap-3">
              <span className={`text-xs ${tokenError ? 'text-destructive' : tokenWarning ? 'text-yellow-600' : 'text-muted-foreground'}`}>
                ~{tokenCount.toLocaleString('pt-BR')} / {TOKEN_LIMIT.toLocaleString('pt-BR')} tokens
              </span>
              {!showDiff ? (
                <button
                  onClick={() => setShowDiff(true)}
                  disabled={!data?.activePrompt || promptText === data.activePrompt.prompt_text}
                  className="rounded-md border px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  Ver diff
                </button>
              ) : (
                <button onClick={() => setShowDiff(false)} className="rounded-md border px-3 py-1.5 text-xs">
                  Editar
                </button>
              )}
            </div>
          </div>

          {tokenWarning && !tokenError && (
            <div className="mb-3 flex items-center gap-2 rounded-md bg-yellow-50 px-3 py-2 text-xs text-yellow-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              Prompt longo pode impactar custo e latência.
            </div>
          )}

          {showDiff ? (
            <PromptDiff
              oldText={data?.activePrompt?.prompt_text ?? ''}
              newText={promptText}
            />
          ) : (
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              rows={14}
              className="w-full rounded-md border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Escreva o system prompt da Aurora..."
            />
          )}

          <div className="mt-3 flex justify-end gap-3">
            <button
              onClick={() => promptMut.mutate({ promptText })}
              disabled={promptMut.isPending || tokenError || !promptText.trim() || promptText === data?.activePrompt?.prompt_text}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {promptMut.isPending ? 'Salvando...' : 'Salvar prompt'}
            </button>
          </div>

          {promptMut.isError && (
            <p className="mt-2 text-sm text-destructive">{promptMut.error.message}</p>
          )}
        </section>

        {/* ── Histórico de prompts ─────────────────────── */}
        {history.length > 0 && (
          <section className="rounded-lg border bg-card p-6 lg:col-span-2">
            <h2 className="mb-4 font-semibold">Histórico de Versões do Prompt</h2>
            <div className="space-y-2">
              {history.map((v, i) => (
                <div
                  key={v.id}
                  className={[
                    'rounded-md border p-3 cursor-pointer hover:bg-accent/50',
                    selectedHistoryId === v.id ? 'border-primary' : '',
                  ].join(' ')}
                  onClick={() => setSelectedHistoryId(v.id === selectedHistoryId ? null : v.id)}
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {i === 0 ? 'Versão atual' : `Versão ${history.length - i}`}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(v.created_at).toLocaleString('pt-BR')}
                      {v.created_by_name && <> · {v.created_by_name}</>}
                      {' '} · ~{v.token_estimate} tokens
                    </span>
                  </div>
                  {selectedHistoryId === v.id && (
                    <div className="mt-3">
                      <pre className="max-h-48 overflow-auto rounded-md bg-muted/40 p-3 text-xs whitespace-pre-wrap">
                        {v.prompt_text}
                      </pre>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPromptText(v.prompt_text);
                          setSelectedHistoryId(null);
                          setShowDiff(false);
                        }}
                        className="mt-2 text-xs text-primary hover:underline"
                      >
                        Restaurar esta versão
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
