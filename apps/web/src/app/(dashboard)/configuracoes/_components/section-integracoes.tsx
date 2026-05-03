'use client';

import * as React from 'react';
import {
  Glass, Btn, Mono, Badge, Ico, Field, Input, Skeleton, T,
} from '@dermaos/ui/ds';
import {
  DialogRoot, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
  ConfirmDialog,
} from '@dermaos/ui';
import { Button } from '@dermaos/ui';
import { trpc } from '@/lib/trpc-provider';
import { useAuth } from '@/lib/auth';
import { copyText } from '@/lib/clipboard';
import type { Channel } from '@dermaos/shared';

const CHANNEL_META: Record<Channel, { label: string; icon: string; description: string }> = {
  whatsapp:  { label: 'WhatsApp Business API', icon: 'message',    description: 'Envio de mensagens, confirmações e comunicação com pacientes' },
  instagram: { label: 'Instagram API',         icon: 'message',    description: 'Recebimento de mensagens e interações via Instagram Direct' },
  telegram:  { label: 'Telegram Bot',          icon: 'message',    description: 'Canal de atendimento via Telegram' },
  email:     { label: 'E-mail SMTP',           icon: 'mail',       description: 'Envio de e-mails transacionais, convites e notificações' },
};

interface IntegrationRow {
  channel: Channel;
  isActive: boolean;
  tokenPreview?: string | null;
  lastVerifiedAt?: string | null;
  lastError?: string | null;
}

export function SectionIntegracoes() {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';

  const integrationsQuery = trpc.settings.integrations.list.useQuery(undefined, { staleTime: 60_000 });

  const updateCredential = trpc.settings.integrations.updateCredential.useMutation({
    onSuccess: () => { void integrationsQuery.refetch(); setConfigChannel(null); setFields({}); },
  });
  const testConnection = trpc.settings.integrations.testConnection.useMutation({
    onSuccess: () => integrationsQuery.refetch(),
  });
  const regenerateSecret = trpc.settings.integrations.regenerateWebhookSecret.useMutation({
    onSuccess: (data) => {
      void integrationsQuery.refetch();
      setNewSecret(data.secret);
    },
  });

  const [configChannel, setConfigChannel] = React.useState<Channel | null>(null);
  const [fields, setFields] = React.useState<Record<string, string>>({});
  const [regeneratingChannel, setRegeneratingChannel] = React.useState<Channel | null>(null);
  const [newSecret, setNewSecret] = React.useState<string | null>(null);
  const [testingChannel, setTestingChannel] = React.useState<Channel | null>(null);

  function setField(key: string, value: string) {
    setFields((s) => ({ ...s, [key]: value }));
  }

  function buildPayload(): Parameters<typeof updateCredential.mutate>[0] | null {
    if (!configChannel) return null;
    switch (configChannel) {
      case 'whatsapp':
        if (!fields['phoneNumberId'] || !fields['accessToken'] || !fields['appSecret'] || !fields['verifyToken']) return null;
        return {
          channel:        'whatsapp',
          phoneNumberId:  fields['phoneNumberId'],
          accessToken:    fields['accessToken'],
          appSecret:      fields['appSecret'],
          verifyToken:    fields['verifyToken'],
        };
      case 'instagram':
        if (!fields['pageId'] || !fields['accessToken'] || !fields['appSecret'] || !fields['verifyToken']) return null;
        return {
          channel:      'instagram',
          pageId:       fields['pageId'],
          accessToken:  fields['accessToken'],
          appSecret:    fields['appSecret'],
          verifyToken:  fields['verifyToken'],
        };
      case 'telegram':
        if (!fields['botToken']) return null;
        return { channel: 'telegram', botToken: fields['botToken'] };
      case 'email':
        if (!fields['host'] || !fields['user'] || !fields['pass']) return null;
        return {
          channel: 'email',
          host:    fields['host'],
          port:    Number(fields['port'] ?? 587),
          user:    fields['user'],
          pass:    fields['pass'],
        };
    }
  }

  function handleSaveToken() {
    const payload = buildPayload();
    if (!payload) return;
    updateCredential.mutate(payload);
  }

  function handleTest(channel: Channel) {
    setTestingChannel(channel);
    testConnection.mutate({ channel }, {
      onSettled: () => setTestingChannel(null),
    });
  }

  if (integrationsQuery.isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} height={80} delay={i * 100} />)}
      </div>
    );
  }

  const integrations = (integrationsQuery.data as IntegrationRow[]) ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {!isOwner && (
        <div style={{ padding: '12px 16px', borderRadius: T.r.md, background: T.warningBg, border: `1px solid ${T.warningBorder}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Ico name="alert" size={14} color={T.warning} />
          <span style={{ fontSize: 13, color: T.warning, fontWeight: 500 }}>
            Integrações são gerenciadas exclusivamente pelo proprietário da clínica.
          </span>
        </div>
      )}

      {integrations.map((intg) => {
        const meta = CHANNEL_META[intg.channel];
        return (
          <Glass key={intg.channel} style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: T.r.md,
                  background: intg.isActive ? T.successBg : T.inputBg,
                  border: `1px solid ${intg.isActive ? T.successBorder : T.divider}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ico name={meta.icon as 'message' | 'mail'} size={18} color={intg.isActive ? T.success : T.textMuted} />
                </div>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 600, color: T.textPrimary }}>{meta.label}</p>
                  <p style={{ fontSize: 13, color: T.textSecondary, marginTop: 2 }}>{meta.description}</p>
                  <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'center' }}>
                    <Badge variant={intg.isActive ? 'success' : 'warning'}>
                      {intg.isActive ? 'Conectado' : 'Pendente'}
                    </Badge>
                    {intg.tokenPreview && (
                      <Mono size={10} color={T.textMuted}>Token: ****{intg.tokenPreview}</Mono>
                    )}
                    {intg.lastVerifiedAt && (
                      <Mono size={10} color={T.textMuted}>
                        Verificado: {new Date(intg.lastVerifiedAt).toLocaleDateString('pt-BR')}
                      </Mono>
                    )}
                  </div>
                  {intg.lastError && (
                    <div style={{ marginTop: 6, padding: '4px 8px', borderRadius: T.r.sm, background: T.dangerBg, fontSize: 12, color: T.danger }}>
                      {intg.lastError}
                    </div>
                  )}
                </div>
              </div>
              {isOwner && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <Btn small variant="ghost" icon="settings" onClick={() => { setConfigChannel(intg.channel); setFields({}); }}>
                    Configurar
                  </Btn>
                  <Btn
                    small
                    variant="glass"
                    icon="zap"
                    loading={testingChannel === intg.channel}
                    onClick={() => handleTest(intg.channel)}
                  >
                    Testar
                  </Btn>
                </div>
              )}
            </div>
          </Glass>
        );
      })}

      {integrations.length === 0 && (
        <Glass style={{ padding: 32, textAlign: 'center' }}>
          <Ico name="layers" size={32} color={T.textMuted} />
          <p style={{ fontSize: 16, fontWeight: 600, color: T.textPrimary, marginTop: 12 }}>
            Nenhuma integração disponível
          </p>
          <p style={{ fontSize: 14, color: T.textSecondary, marginTop: 4 }}>
            As integrações serão exibidas quando o backend estiver configurado.
          </p>
        </Glass>
      )}

      {/* Configure Token Dialog */}
      <DialogRoot open={!!configChannel} onOpenChange={(open) => !open && setConfigChannel(null)}>
        <DialogContent a11yTitle="Configurar integração">
          <DialogHeader>
            <DialogTitle>Configurar {configChannel ? CHANNEL_META[configChannel].label : ''}</DialogTitle>
            <DialogDescription>
              Insira o token de acesso. Ele será criptografado com AES-256-GCM e nunca será exibido em texto claro.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {updateCredential.error && (
              <div style={{ padding: '8px 12px', borderRadius: T.r.md, background: T.dangerBg, border: `1px solid ${T.dangerBorder}`, fontSize: 13, color: T.danger }}>
                {updateCredential.error.message}
              </div>
            )}
            {configChannel === 'whatsapp' && (
              <>
                <Field label="Phone Number ID" required>
                  <Input value={fields['phoneNumberId'] ?? ''} onChange={(e) => setField('phoneNumberId', e.target.value)} placeholder="ex: 100000000000001" />
                </Field>
                <Field label="Access Token (permanente)" required>
                  <Input value={fields['accessToken'] ?? ''} onChange={(e) => setField('accessToken', e.target.value)} placeholder="EAA..." type="password" style={{ fontFamily: "'IBM Plex Mono', monospace" }} />
                </Field>
                <Field label="App Secret (HMAC dos webhooks)" required>
                  <Input value={fields['appSecret'] ?? ''} onChange={(e) => setField('appSecret', e.target.value)} type="password" style={{ fontFamily: "'IBM Plex Mono', monospace" }} />
                </Field>
                <Field label="Verify Token (handshake GET)" required>
                  <Input value={fields['verifyToken'] ?? ''} onChange={(e) => setField('verifyToken', e.target.value)} placeholder="Token aleatório" />
                </Field>
                <Mono size={10} color={T.textMuted}>Os campos sensíveis são cifrados em AES-256-GCM antes de persistir.</Mono>
              </>
            )}
            {configChannel === 'instagram' && (
              <>
                <Field label="Page ID" required>
                  <Input value={fields['pageId'] ?? ''} onChange={(e) => setField('pageId', e.target.value)} />
                </Field>
                <Field label="Access Token" required>
                  <Input value={fields['accessToken'] ?? ''} onChange={(e) => setField('accessToken', e.target.value)} type="password" />
                </Field>
                <Field label="App Secret" required>
                  <Input value={fields['appSecret'] ?? ''} onChange={(e) => setField('appSecret', e.target.value)} type="password" />
                </Field>
                <Field label="Verify Token" required>
                  <Input value={fields['verifyToken'] ?? ''} onChange={(e) => setField('verifyToken', e.target.value)} />
                </Field>
              </>
            )}
            {configChannel === 'telegram' && (
              <Field label="Bot Token" required>
                <Input value={fields['botToken'] ?? ''} onChange={(e) => setField('botToken', e.target.value)} placeholder="123456:AAEhBP..." type="password" style={{ fontFamily: "'IBM Plex Mono', monospace" }} />
              </Field>
            )}
            {configChannel === 'email' && (
              <>
                <Field label="Host SMTP" required>
                  <Input value={fields['host'] ?? ''} onChange={(e) => setField('host', e.target.value)} placeholder="smtp.gmail.com" />
                </Field>
                <Field label="Porta">
                  <Input value={fields['port'] ?? '587'} onChange={(e) => setField('port', e.target.value)} placeholder="587" />
                </Field>
                <Field label="Usuário" required>
                  <Input value={fields['user'] ?? ''} onChange={(e) => setField('user', e.target.value)} placeholder="user@dominio.com" />
                </Field>
                <Field label="Senha" required>
                  <Input value={fields['pass'] ?? ''} onChange={(e) => setField('pass', e.target.value)} type="password" />
                </Field>
              </>
            )}

            <div style={{ borderTop: `1px solid ${T.divider}`, paddingTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>Webhook Secret</p>
                  <Mono size={10} color={T.textMuted}>Regenerar o secret invalida o anterior imediatamente.</Mono>
                </div>
                <Btn
                  small
                  variant="danger"
                  icon="lock"
                  onClick={() => setRegeneratingChannel(configChannel)}
                >
                  Regenerar
                </Btn>
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button
              onClick={handleSaveToken}
              isLoading={updateCredential.isPending}
              disabled={!buildPayload()}
            >
              Salvar credenciais
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>

      {/* Regenerate Secret Confirm */}
      <ConfirmDialog
        open={!!regeneratingChannel}
        onOpenChange={(open) => { if (!open) { setRegeneratingChannel(null); setNewSecret(null); } }}
        title="Regenerar Webhook Secret?"
        description="O secret anterior será invalidado. Atualize a configuração no serviço externo."
        confirmLabel="Regenerar"
        onConfirm={() => {
          if (regeneratingChannel) regenerateSecret.mutate({ channel: regeneratingChannel });
        }}
        isLoading={regenerateSecret.isPending}
      />

      {/* New Secret Display */}
      {newSecret && (
        <DialogRoot open onOpenChange={() => setNewSecret(null)}>
          <DialogContent a11yTitle="Novo secret">
            <DialogHeader>
              <DialogTitle>Novo Webhook Secret</DialogTitle>
              <DialogDescription>Copie agora — este valor não será exibido novamente.</DialogDescription>
            </DialogHeader>
            <div className="px-6 py-4">
              <div style={{ padding: '12px 16px', borderRadius: T.r.md, background: T.inputBg, border: `1px solid ${T.primaryBorder}`, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, wordBreak: 'break-all', color: T.textPrimary }}>
                {newSecret}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { void copyText(newSecret); }}>
                Copiar
              </Button>
              <DialogClose asChild>
                <Button>Fechar</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </DialogRoot>
      )}
    </div>
  );
}
