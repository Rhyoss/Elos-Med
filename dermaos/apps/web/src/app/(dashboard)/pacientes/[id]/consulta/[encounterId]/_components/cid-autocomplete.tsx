'use client';

import * as React from 'react';
import { X, Search, Star, StarOff } from 'lucide-react';
import { Input, Badge, AiBadge, Button } from '@dermaos/ui';
import { trpc } from '@/lib/trpc-provider';
import { cn } from '@/lib/utils';
import type { EncounterDiagnosisInput, AiCidSuggestion } from '@dermaos/shared';

interface CidAutocompleteProps {
  diagnoses: EncounterDiagnosisInput[];
  onChange:  (diagnoses: EncounterDiagnosisInput[]) => void;
  soapText:  string;
  disabled?: boolean;
}

export function CidAutocomplete({ diagnoses, onChange, soapText, disabled }: CidAutocompleteProps) {
  const [query, setQuery] = React.useState('');
  const [suggestions, setSuggestions] = React.useState<AiCidSuggestion[]>([]);

  const searchQuery = trpc.clinical.encounters.searchCid.useQuery(
    { query, limit: 10 },
    { enabled: query.trim().length >= 2, staleTime: 10_000 },
  );
  const aiMutation = trpc.clinical.encounters.aiSuggestCids.useMutation();

  function addDiagnosis(d: EncounterDiagnosisInput) {
    if (diagnoses.some((existing) => existing.code === d.code)) return;
    // Primeiro diagnóstico automaticamente primário
    const isFirst = diagnoses.length === 0;
    onChange([
      ...diagnoses,
      { ...d, isPrimary: d.isPrimary || isFirst },
    ]);
    setQuery('');
  }

  function removeDiagnosis(code: string) {
    onChange(diagnoses.filter((d) => d.code !== code));
  }

  function togglePrimary(code: string) {
    onChange(diagnoses.map((d) => (
      d.code === code ? { ...d, isPrimary: !d.isPrimary } : d
    )));
  }

  async function requestAiSuggestions() {
    if (soapText.trim().length < 20) return;
    try {
      const res = await aiMutation.mutateAsync({ soapText });
      setSuggestions(res.suggestions);
    } catch {
      setSuggestions([]);
    }
  }

  function ignoreSuggestion(cid: string) {
    setSuggestions((prev) => prev.filter((s) => s.cid !== cid));
  }

  function acceptSuggestion(s: AiCidSuggestion) {
    addDiagnosis({
      code:        s.cid,
      description: s.description,
      isPrimary:   false,
      aiGenerated: true,
      confidence:  s.confidence,
    });
    ignoreSuggestion(s.cid);
  }

  return (
    <section aria-labelledby="diagnoses-heading" className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 id="diagnoses-heading" className="text-sm font-semibold text-foreground">
          Diagnósticos (CID-10)
        </h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={requestAiSuggestions}
          disabled={disabled || aiMutation.isPending || soapText.trim().length < 20}
          title="Sugerir CIDs com IA a partir do texto SOAP"
        >
          {aiMutation.isPending ? 'Analisando…' : '✨ IA: Sugerir CIDs'}
        </Button>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar CID por código ou descrição…"
          aria-label="Buscar CID-10"
          disabled={disabled}
          className="pl-9"
        />
        {query.trim().length >= 2 && searchQuery.data?.results && searchQuery.data.results.length > 0 && (
          <ul
            role="listbox"
            aria-label="Resultados da busca de CID"
            className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-popover p-1 text-sm shadow-md"
          >
            {searchQuery.data.results.map((r) => (
              <li key={r.code}>
                <button
                  type="button"
                  onClick={() => addDiagnosis({
                    code:        r.code,
                    description: r.description,
                    isPrimary:   false,
                    aiGenerated: false,
                  })}
                  className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left hover:bg-hover focus:bg-hover focus:outline-none"
                >
                  <span className="shrink-0 font-mono text-xs font-semibold text-primary-700">
                    {r.code}
                  </span>
                  <span className="flex-1 text-xs text-foreground">{r.description}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Diagnósticos selecionados */}
      {diagnoses.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum diagnóstico adicionado.</p>
      ) : (
        <ul className="flex flex-wrap gap-2" aria-label="Diagnósticos selecionados">
          {diagnoses.map((d) => (
            <li key={d.code}>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium',
                  d.isPrimary
                    ? 'border-primary/40 bg-primary-100 text-primary-700'
                    : 'border-border bg-muted text-foreground',
                )}
              >
                <span className="font-mono">{d.code}</span>
                <span className="max-w-[12rem] truncate">{d.description}</span>
                {d.aiGenerated && <AiBadge size="inline" />}
                <button
                  type="button"
                  onClick={() => togglePrimary(d.code)}
                  aria-label={d.isPrimary ? `Remover ${d.code} como primário` : `Marcar ${d.code} como primário`}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-background/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  disabled={disabled}
                >
                  {d.isPrimary
                    ? <Star className="h-3 w-3 fill-current" aria-hidden="true" />
                    : <StarOff className="h-3 w-3" aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  onClick={() => removeDiagnosis(d.code)}
                  aria-label={`Remover diagnóstico ${d.code}`}
                  className="rounded-full p-0.5 hover:bg-background/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  disabled={disabled}
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Sugestões de IA */}
      {suggestions.length > 0 && (
        <div className="rounded-md border border-dashed border-ai/50 bg-ai-100/40 p-3" role="region" aria-label="Sugestões de IA">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-ai-700">
            <AiBadge size="inline" />
            Sugestões da IA — revise antes de aceitar
          </div>
          <ul className="space-y-1.5">
            {suggestions.map((s) => {
              const lowConf = s.confidence < 0.7;
              return (
                <li
                  key={s.cid}
                  className={cn(
                    'flex items-center gap-2 rounded border border-border bg-card px-2 py-1.5',
                    lowConf && 'opacity-70',
                  )}
                >
                  <span className="shrink-0 font-mono text-xs font-semibold text-primary-700">
                    {s.cid}
                  </span>
                  <span className="flex-1 truncate text-xs text-foreground">
                    {s.description}
                  </span>
                  <Badge variant={lowConf ? 'warning' : 'info'} size="sm">
                    {Math.round(s.confidence * 100)}%
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => acceptSuggestion(s)}
                    disabled={disabled}
                  >
                    Aceitar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => ignoreSuggestion(s.cid)}
                    disabled={disabled}
                  >
                    Ignorar
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
