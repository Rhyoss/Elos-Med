'use client';

import * as React from 'react';
import {
  Glass, Btn, Mono, Badge, Ico, Field, Input, Skeleton, Toggle, T,
} from '@dermaos/ui/ds';
import { Textarea } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { useAuth } from '@/lib/auth';

export function SectionIA() {
  const { user } = useAuth();
  const isPrivileged = user?.role === 'owner' || user?.role === 'admin';

  const aiQuery = trpc.settings.ai.get.useQuery(undefined, { staleTime: 60_000 });
  const historyQuery = trpc.settings.ai.promptHistory.useQuery(undefined, { staleTime: 60_000 });

  const updateAI = trpc.settings.ai.update.useMutation({
    onSuccess: () => {
      void aiQuery.refetch();
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 3000);
    },
    onError: (err) => {
      setSaveStatus('error');
      setErrorMsg(err.message);
    },
  });

  const updatePrompt = trpc.settings.ai.updatePrompt.useMutation({
    onSuccess: () => {
      void aiQuery.refetch();
      void historyQuery.refetch();
      setPromptSaveStatus('success');
      setTimeout(() => setPromptSaveStatus(null), 3000);
    },
    onError: (err) => {
      setPromptSaveStatus('error');
      setPromptErrorMsg(err.message);
    },
  });

  const [auroraEnabled, setAuroraEnabled] = React.useState(false);
  const [preferredModel, setPreferredModel] = React.useState('claude-sonnet-4-6');
  const [configDirty, setConfigDirty] = React.useState(false);

  const [promptText, setPromptText] = React.useState('');
  const [promptDirty, setPromptDirty] = React.useState(false);

  const [saveStatus, setSaveStatus] = React.useState<'success' | 'error' | null>(null);
  const [errorMsg, setErrorMsg] = React.useState('');
  const [promptSaveStatus, setPromptSaveStatus] = React.useState<'success' | 'error' | null>(null);
  const [promptErrorMsg, setPromptErrorMsg] = React.useState('');

  React.useEffect(() => {
    if (aiQuery.data) {
      const d = aiQuery.data as { auroraEnabled?: boolean; preferredModel?: string; activePrompt?: string };
      setAuroraEnabled(d.auroraEnabled ?? false);
      setPreferredModel(d.preferredModel ?? 'claude-sonnet-4-6');
      setPromptText(d.activePrompt ?? '');
      setConfigDirty(false);
      setPromptDirty(false);
    }
  }, [aiQuery.data]);

  function handleSaveConfig() {
    updateAI.mutate({ auroraEnabled, preferredModel });
  }

  function handleSavePrompt() {
    if (!promptText.trim()) return;
    updatePrompt.mutate({ promptText: promptText.trim() });
  }

  const tokenEstimate = Math.ceil(promptText.length / 4);

  if (aiQuery.isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} height={60} delay={i * 100} />)}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Config */}
      <Glass style={{ padding: '24px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <Mono size={10} spacing="1.1px" color={T.primary}>AURORA IA — CONFIGURAÇÃO</Mono>
            <p style={{ fontSize: 14, color: T.textSecondary, marginTop: 4 }}>
              Habilite e configure o assistente de IA da clínica
            </p>
          </div>
          {isPrivileged && (
            <Btn
              small icon="check"
              disabled={!configDirty}
              loading={updateAI.isPending}
              onClick={handleSaveConfig}
            >
              Salvar
            </Btn>
          )}
        </div>

        {saveStatus === 'success' && (
          <div style={{ padding: '10px 14px', borderRadius: T.r.md, background: T.successBg, border: `1px solid ${T.successBorder}`, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Ico name="check" size={14} color={T.success} />
            <span style={{ fontSize: 13, color: T.success, fontWeight: 500 }}>Configuração salva</span>
          </div>
        )}
        {saveStatus === 'error' && (
          <div style={{ padding: '10px 14px', borderRadius: T.r.md, background: T.dangerBg, border: `1px solid ${T.dangerBorder}`, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Ico name="alert" size={14} color={T.danger} />
            <span style={{ fontSize: 13, color: T.danger, fontWeight: 500 }}>{errorMsg || 'Erro ao salvar'}</span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderRadius: T.r.md, background: T.inputBg, border: `1px solid ${T.divider}` }}>
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary }}>Aurora IA</p>
              <p style={{ fontSize: 13, color: T.textSecondary, marginTop: 2 }}>
                Assistente inteligente para insights, previsões e sugestões clínicas
              </p>
            </div>
            <Toggle
              checked={auroraEnabled}
              onChange={(v) => { setAuroraEnabled(v); setConfigDirty(true); }}
              disabled={!isPrivileged}
              label="Habilitar Aurora"
            />
          </div>

          <Field label="Modelo preferido">
            <Select
              value={preferredModel}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setPreferredModel(e.target.value); setConfigDirty(true); }}
              disabled={!isPrivileged}
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
              <option value="claude-opus-4-6">Claude Opus 4.6</option>
              <option value="claude-haiku-4-5">Claude Haiku 4.5</option>
            </Select>
          </Field>
        </div>
      </Glass>

      {/* System Prompt */}
      <Glass style={{ padding: '24px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <Mono size={10} spacing="1.1px" color={T.primary}>SYSTEM PROMPT</Mono>
            <p style={{ fontSize: 14, color: T.textSecondary, marginTop: 4 }}>
              Prompt do sistema que orienta o comportamento da IA. Limite: ~4.000 tokens.
            </p>
          </div>
          {isPrivileged && (
            <Btn
              small icon="check"
              disabled={!promptDirty || !promptText.trim()}
              loading={updatePrompt.isPending}
              onClick={handleSavePrompt}
            >
              Salvar prompt
            </Btn>
          )}
        </div>

        {promptSaveStatus === 'success' && (
          <div style={{ padding: '10px 14px', borderRadius: T.r.md, background: T.successBg, border: `1px solid ${T.successBorder}`, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Ico name="check" size={14} color={T.success} />
            <span style={{ fontSize: 13, color: T.success, fontWeight: 500 }}>Prompt salvo — nova versão criada</span>
          </div>
        )}
        {promptSaveStatus === 'error' && (
          <div style={{ padding: '10px 14px', borderRadius: T.r.md, background: T.dangerBg, border: `1px solid ${T.dangerBorder}`, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Ico name="alert" size={14} color={T.danger} />
            <span style={{ fontSize: 13, color: T.danger, fontWeight: 500 }}>{promptErrorMsg || 'Erro ao salvar prompt'}</span>
          </div>
        )}

        <Textarea
          value={promptText}
          onChange={(e) => { setPromptText(e.target.value); setPromptDirty(true); }}
          disabled={!isPrivileged}
          rows={10}
          placeholder="Você é Aurora, assistente de IA da clínica dermatológica..."
          style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <Mono size={10} color={tokenEstimate > 4000 ? T.danger : T.textMuted}>
            ~{tokenEstimate.toLocaleString()} tokens estimados
            {tokenEstimate > 4000 && ' (excede limite)'}
          </Mono>
          <Mono size={10} color={T.textMuted}>
            {promptText.length.toLocaleString()} / 20.000 caracteres
          </Mono>
        </div>
      </Glass>

      {/* Prompt History */}
      <Glass style={{ padding: '24px 28px' }}>
        <Mono size={10} spacing="1.1px" color={T.textMuted} style={{ marginBottom: 16 }}>HISTÓRICO DE VERSÕES</Mono>
        {historyQuery.isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} height={36} delay={i * 80} />)}
          </div>
        ) : (historyQuery.data as Array<{ id: string; prompt_text: string; token_estimate: number; created_at: string; creator_name?: string }> | undefined)?.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(historyQuery.data as Array<{ id: string; prompt_text: string; token_estimate: number; created_at: string; creator_name?: string }>).map((v, i) => (
              <div
                key={v.id}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', borderRadius: T.r.md,
                  background: i === 0 ? T.primaryBg : T.inputBg,
                  border: `1px solid ${i === 0 ? T.primaryBorder : T.divider}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {i === 0 && <Badge variant="success">Ativo</Badge>}
                  <span style={{ fontSize: 13, color: T.textPrimary }}>
                    {v.prompt_text.slice(0, 60)}{v.prompt_text.length > 60 ? '...' : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Mono size={10}>{v.token_estimate} tokens</Mono>
                  <Mono size={10} color={T.textMuted}>
                    {v.creator_name ?? '—'} · {new Date(v.created_at).toLocaleDateString('pt-BR')}
                  </Mono>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Mono size={12} color={T.textMuted}>Nenhuma versão registrada.</Mono>
        )}
      </Glass>
    </div>
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean | string }) {
  const { error: _error, ...rest } = props;
  return (
    <select
      {...rest}
      style={{
        width: '100%', padding: '9px 13px', borderRadius: 8,
        background: T.inputBg, border: `1px solid ${T.inputBorder}`,
        color: T.textPrimary, fontSize: 13,
        fontFamily: "'IBM Plex Sans', sans-serif",
        outline: 'none', cursor: 'pointer',
        ...rest.style,
      }}
    />
  );
}
