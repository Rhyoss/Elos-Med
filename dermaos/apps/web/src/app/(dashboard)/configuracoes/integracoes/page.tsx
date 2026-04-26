'use client';

import * as React from 'react';
import { CheckCircle, XCircle, RefreshCw, Copy, RotateCcw, AlertTriangle } from 'lucide-react';
import { trpc } from '@/lib/trpc-provider';
import { PageHeader } from '@dermaos/ui';
import type { Channel } from '@dermaos/shared';

const CHANNEL_LABELS: Record<Channel, string> = {
  whatsapp:  'WhatsApp Business',
  instagram: 'Instagram Direct',
  telegram:  'Telegram',
  email:     'E-mail (SMTP)',
};

const CHANNEL_FIELD_LABELS: Record<Channel, string> = {
  whatsapp:  'Access Token',
  instagram: 'Access Token',
  telegram:  'Bot Token',
  email:     'Senha SMTP',
};

function StatusIcon({ connected }: { connected: boolean }) {
  return connected
    ? <CheckCircle className="h-5 w-5 text-green-500" />
    : <XCircle className="h-5 w-5 text-red-400" />;
}

function UpdateTokenModal({
  channel,
  onClose,
}: { channel: Channel; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [token, setToken] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const updateMut = trpc.settings.integrations.updateCredential.useMutation({
    onSuccess: () => { utils.settings.integrations.list.invalidate(); onClose(); },
    onError: (e) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-xl">
        <h2 className="mb-2 text-lg font-semibold">Atualizar token — {CHANNEL_LABELS[channel]}</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          O token será validado com o serviço antes de ser salvo.
        </p>
        <label className="mb-1 block text-sm font-medium">{CHANNEL_FIELD_LABELS[channel]}</label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Cole o token aqui"
          className="w-full rounded-md border px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        <div className="mt-4 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-md border px-4 py-2 text-sm">Cancelar</button>
          <button
            onClick={() => updateMut.mutate({ channel, token })}
            disabled={updateMut.isPending || token.length < 8}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            {updateMut.isPending ? 'Validando e salvando...' : 'Salvar token'}
          </button>
        </div>
      </div>
    </div>
  );
}

function WebhookSecretModal({
  channel,
  webhookUrl,
  secret,
  onClose,
}: { channel: Channel; webhookUrl: string; secret: string; onClose: () => void }) {
  const [copied, setCopied] = React.useState<'url' | 'secret' | null>(null);

  function copyToClipboard(text: string, which: 'url' | 'secret') {
    navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl border bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          <h2 className="text-lg font-semibold">Secret gerado — guarde agora</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Este secret será exibido apenas <strong>uma vez</strong>. Após fechar este modal, apenas os últimos 4 caracteres serão visíveis.
        </p>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">URL do Webhook</label>
            <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
              <code className="flex-1 break-all text-xs">{webhookUrl}</code>
              <button onClick={() => copyToClipboard(webhookUrl, 'url')} className="shrink-0 text-muted-foreground hover:text-foreground">
                {copied === 'url' ? <span className="text-xs text-green-600">Copiado!</span> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Webhook Secret</label>
            <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
              <code className="flex-1 break-all text-xs font-bold">{secret}</code>
              <button onClick={() => copyToClipboard(secret, 'secret')} className="shrink-0 text-muted-foreground hover:text-foreground">
                {copied === 'secret' ? <span className="text-xs text-green-600">Copiado!</span> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={onClose}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
            Entendido — fechar
          </button>
        </div>
      </div>
    </div>
  );
}

type IntegrationRow = {
  channel: Channel;
  isActive: boolean;
  tokenPreview: string | null;
  lastVerifiedAt: string | null;
  lastError: string | null;
  webhookUrl: string;
  secretPreview: string | null;
  hasWebhook: boolean;
};

export default function IntegracoesPage() {
  const utils = trpc.useUtils();
  const [updateChannel, setUpdateChannel] = React.useState<Channel | null>(null);
  const [webhookModal, setWebhookModal] = React.useState<{ channel: Channel; webhookUrl: string; secret: string } | null>(null);

  const listQuery = trpc.settings.integrations.list.useQuery();
  const testMut   = trpc.settings.integrations.testConnection.useMutation({
    onSuccess: () => utils.settings.integrations.list.invalidate(),
  });
  const regenMut  = trpc.settings.integrations.regenerateWebhookSecret.useMutation({
    onSuccess: (data, variables) => {
      utils.settings.integrations.list.invalidate();
      const integration = integrations.find((i) => i.channel === variables.channel);
      setWebhookModal({
        channel: variables.channel,
        webhookUrl: integration?.webhookUrl ?? '',
        secret: data.secret,
      });
    },
  });

  const integrations = (listQuery.data ?? []) as IntegrationRow[];

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Integrações"
        description="Canais de comunicação e credenciais de serviços externos"
      />

      <div className="grid gap-4 p-6 lg:grid-cols-2">
        {integrations.map((integration) => (
          <div key={integration.channel} className="rounded-lg border bg-card p-5">
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <StatusIcon connected={integration.isActive} />
                <div>
                  <h3 className="font-medium">{CHANNEL_LABELS[integration.channel]}</h3>
                  <p className="text-xs text-muted-foreground">
                    {integration.isActive ? 'Conectado' : 'Desconectado'}
                    {integration.lastVerifiedAt && (
                      <> · {new Date(integration.lastVerifiedAt).toLocaleTimeString('pt-BR')}</>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => testMut.mutate({ channel: integration.channel })}
                disabled={testMut.isPending}
                className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${testMut.isPending ? 'animate-spin' : ''}`} />
                Testar
              </button>
            </div>

            {integration.lastError && (
              <div className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {integration.lastError}
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{CHANNEL_FIELD_LABELS[integration.channel]}</span>
                <div className="flex items-center gap-2">
                  <code className="rounded bg-muted px-2 py-0.5 text-xs">
                    {integration.tokenPreview ? `****${integration.tokenPreview}` : 'Não configurado'}
                  </code>
                  <button
                    onClick={() => setUpdateChannel(integration.channel)}
                    className="text-xs text-primary hover:underline"
                  >
                    Atualizar
                  </button>
                </div>
              </div>

              <div className="border-t pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Webhook Secret</span>
                  <code className="rounded bg-muted px-2 py-0.5 text-xs">
                    {integration.secretPreview ? `****${integration.secretPreview}` : 'Não gerado'}
                  </code>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs">
                    {integration.webhookUrl}
                  </code>
                  <button
                    onClick={() => {
                      if (!integration.hasWebhook || confirm('Regenerar invalidará o secret atual. Confirmar?')) {
                        regenMut.mutate({ channel: integration.channel });
                      }
                    }}
                    disabled={regenMut.isPending}
                    className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                    title={integration.hasWebhook ? 'Regenerar secret' : 'Gerar secret'}
                  >
                    <RotateCcw className="h-3 w-3" />
                    {integration.hasWebhook ? 'Regenerar' : 'Gerar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Gateway de pagamento — em breve */}
        <div className="rounded-lg border bg-card p-5 opacity-60">
          <div className="mb-2 flex items-center gap-2">
            <XCircle className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-medium">Gateways de Pagamento</h3>
          </div>
          <p className="text-sm text-muted-foreground">Em breve — PagSeguro, Stripe, Mercado Pago</p>
          <button className="mt-3 rounded-md border px-3 py-1.5 text-xs text-muted-foreground">
            Tenho interesse
          </button>
        </div>
      </div>

      {updateChannel && <UpdateTokenModal channel={updateChannel} onClose={() => setUpdateChannel(null)} />}
      {webhookModal && (
        <WebhookSecretModal
          channel={webhookModal.channel}
          webhookUrl={webhookModal.webhookUrl}
          secret={webhookModal.secret}
          onClose={() => setWebhookModal(null)}
        />
      )}
    </div>
  );
}
