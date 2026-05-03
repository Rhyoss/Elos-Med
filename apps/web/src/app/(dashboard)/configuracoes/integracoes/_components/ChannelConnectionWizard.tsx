'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Glass, Btn, Ico, Mono, T } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import type { ChannelViewModel } from '../_lib/channel-adapter';
import { CHANNEL_DEFINITIONS, type ChannelType } from '../_lib/channel-adapter';
import type { Channel as BackendChannel, UpdateCredentialInput } from '@dermaos/shared';
import {
  WIZARD_STEPS,
  CHANNEL_WIZARD_CONFIGS,
  getChannelWizardConfig,
  type WizardStepId,
  type WizardStatus,
  type ConnectionMethodId,
  type ChannelWizardConfig,
} from '../_lib/wizard-config';
import { ConnectionMethodSelector } from './wizard/ConnectionMethodSelector';
import { CredentialForm } from './wizard/CredentialForm';
import { WebhookConfigPanel } from './wizard/WebhookConfigPanel';
import { ChannelRoutingRules } from './wizard/ChannelRoutingRules';
import { TestConnectionDialog, type TestResult } from './wizard/TestConnectionDialog';
import { ActivationReview } from './wizard/ActivationReview';
import { WhatsAppConnectionConfig } from './wizard/WhatsAppConnectionConfig';
import { InstagramConnectionConfig } from './wizard/InstagramConnectionConfig';
import { FacebookConnectionConfig } from './wizard/FacebookConnectionConfig';
import { EmailConnectionConfig } from './wizard/EmailConnectionConfig';
import { SmsConnectionConfig } from './wizard/SmsConnectionConfig';
import { PhoneConnectionConfig } from './wizard/PhoneConnectionConfig';
import { WebchatConnectionConfig } from './wizard/WebchatConnectionConfig';
import { CustomChannelConnectionConfig } from './wizard/CustomChannelConnectionConfig';

// ── Wizard state ────────────────────────────────────────────────────

interface WizardState {
  channelType: ChannelType | null;
  connectionMethod: ConnectionMethodId | null;
  credentials: Record<string, string>;
  credentialErrors: Record<string, string>;
  verifyToken: string;
  selectedEvents: string[];
  routingValues: Record<string, string | boolean>;
  testResult: TestResult | null;
  isTesting: boolean;
  status: WizardStatus;
  isActivating: boolean;
}

const INITIAL_STATE: WizardState = {
  channelType: null,
  connectionMethod: null,
  credentials: {},
  credentialErrors: {},
  verifyToken: '',
  selectedEvents: [],
  routingValues: {},
  testResult: null,
  isTesting: false,
  status: 'draft',
  isActivating: false,
};

// ── Props ───────────────────────────────────────────────────────────

interface ChannelConnectionWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialChannel?: ChannelViewModel;
}

export function ChannelConnectionWizard({
  open,
  onOpenChange,
  initialChannel,
}: ChannelConnectionWizardProps) {
  const [currentStep, setCurrentStep] = React.useState<WizardStepId>('channel');
  const [state, setState] = React.useState<WizardState>(INITIAL_STATE);

  const config = state.channelType ? getChannelWizardConfig(state.channelType) : null;

  React.useEffect(() => {
    if (open && initialChannel) {
      setState((s) => ({ ...s, channelType: initialChannel.type }));
      setCurrentStep('method');
    }
  }, [open, initialChannel]);

  React.useEffect(() => {
    if (!open) {
      setState(INITIAL_STATE);
      setCurrentStep('channel');
    }
  }, [open]);

  const stepIndex = WIZARD_STEPS.findIndex((s) => s.id === currentStep);
  const currentStepDef = WIZARD_STEPS[stepIndex];

  const utils = trpc.useUtils();
  const updateCredentialMut = trpc.settings.integrations.updateCredential.useMutation();
  const testConnectionMut = trpc.settings.integrations.testConnection.useMutation();

  /** Mapeia tipo da UI → enum do backend (apenas 4 são suportados). */
  const backendChannel: BackendChannel | null = (() => {
    switch (state.channelType) {
      case 'whatsapp':  return 'whatsapp';
      case 'instagram': return 'instagram';
      case 'sms':       return 'telegram';
      case 'email':     return 'email';
      default:          return null;
    }
  })();

  /**
   * Para canais com integração real no backend (whatsapp/instagram/telegram/email)
   * usamos os campos planos exigidos pela mutation `updateCredential` em vez
   * dos campos do wizard-config.ts.
   */
  function backendPayload(): UpdateCredentialInput | null {
    if (!backendChannel) return null;
    const c = state.credentials;
    switch (backendChannel) {
      case 'whatsapp':
        if (!c['phoneNumberId'] || !c['accessToken'] || !c['appSecret'] || !c['verifyToken']) return null;
        return {
          channel:        'whatsapp',
          phoneNumberId:  c['phoneNumberId'],
          accessToken:    c['accessToken'],
          appSecret:      c['appSecret'],
          verifyToken:    c['verifyToken'],
        };
      case 'instagram':
        if (!c['pageId'] || !c['accessToken'] || !c['appSecret'] || !c['verifyToken']) return null;
        return {
          channel:      'instagram',
          pageId:       c['pageId'],
          accessToken:  c['accessToken'],
          appSecret:    c['appSecret'],
          verifyToken:  c['verifyToken'],
        };
      case 'telegram':
        if (!c['botToken']) return null;
        return { channel: 'telegram', botToken: c['botToken'] };
      case 'email':
        if (!c['host'] || !c['user'] || !c['pass']) return null;
        return {
          channel: 'email',
          host:    c['host'],
          port:    Number(c['port'] ?? 587),
          user:    c['user'],
          pass:    c['pass'],
        };
    }
  }

  function canAdvance(): boolean {
    switch (currentStep) {
      case 'channel':
        return state.channelType !== null;
      case 'method':
        return state.connectionMethod !== null;
      case 'credentials': {
        if (!config || !state.connectionMethod) return false;
        // Para canais com backend real, valida pelos campos da mutation.
        if (backendChannel && state.connectionMethod !== 'manual_link') {
          return backendPayload() !== null;
        }
        const fields = config.credentialFields[state.connectionMethod];
        return fields.every((f) => !f.required || state.credentials[f.key]?.trim());
      }
      case 'webhook':
        return true;
      case 'routing':
        return true;
      case 'test':
        return state.status === 'ready' || state.status === 'activated';
      case 'activation':
        return state.status === 'activated';
      default:
        return false;
    }
  }

  function goNext() {
    if (currentStep === 'credentials') {
      if (!validateCredentials()) return;
    }

    let nextIndex = stepIndex + 1;

    if (state.connectionMethod === 'manual_link') {
      if (currentStep === 'credentials') nextIndex = WIZARD_STEPS.findIndex((s) => s.id === 'test');
      if (currentStep === 'test') nextIndex = WIZARD_STEPS.findIndex((s) => s.id === 'activation');
    }

    const selectedMethod = config?.connectionMethods.find((m) => m.id === state.connectionMethod);
    if (selectedMethod?.requiresBackend) {
      if (currentStep === 'credentials') nextIndex = WIZARD_STEPS.findIndex((s) => s.id === 'activation');
    }

    const next = WIZARD_STEPS[nextIndex];
    if (next) setCurrentStep(next.id);
  }

  function goBack() {
    const prev = WIZARD_STEPS[stepIndex - 1];
    if (prev) setCurrentStep(prev.id);
  }

  function validateCredentials(): boolean {
    if (!config || !state.connectionMethod) return false;
    // Para canais com backend real, valida pelos campos da mutation (a UI
    // específica do canal renderiza apenas esses campos — não há sentido em
    // exigir os campos extras do wizard-config.ts).
    if (backendChannel && state.connectionMethod !== 'manual_link') {
      const ok = backendPayload() !== null;
      if (!ok) {
        setState((s) => ({ ...s, credentialErrors: { _form: 'Preencha todos os campos obrigatórios.' } }));
      } else {
        setState((s) => ({ ...s, credentialErrors: {} }));
      }
      return ok;
    }
    const fields = config.credentialFields[state.connectionMethod];
    const errors: Record<string, string> = {};
    for (const f of fields) {
      if (f.required && !state.credentials[f.key]?.trim()) {
        errors[f.key] = 'Campo obrigatório';
      }
    }
    setState((s) => ({ ...s, credentialErrors: errors }));
    return Object.keys(errors).length === 0;
  }

  function handleTest() {
    // Modo `manual_link` (apenas link wa.me/) — não há API a testar.
    if (state.connectionMethod === 'manual_link') {
      const phone = state.credentials['link_phone']?.trim();
      setState((s) => ({
        ...s,
        testResult: {
          success: !!phone,
          message: phone
            ? `Link wa.me/${phone.replace(/\D/g, '')} gerado. Este modo não testa conexão de API.`
            : 'Informe o número do WhatsApp.',
          details: phone ? 'Modo manual — sem verificação de API' : undefined,
        },
        status: phone ? 'ready' : 'error',
      }));
      return;
    }

    // Validação local para canais sem backend real (BSP, custom, etc).
    if (!backendChannel) {
      const hasCredentials = Object.values(state.credentials).some((v) => v.trim());
      setState((s) => ({
        ...s,
        testResult: {
          success: hasCredentials,
          message: hasCredentials
            ? 'Credenciais preenchidas. Integração com este provedor ainda não tem teste automatizado no backend.'
            : 'Nenhuma credencial foi fornecida.',
        },
        status: hasCredentials ? 'ready' : 'error',
      }));
      return;
    }

    // Para canais com backend real: salva → testa → mostra o resultado real.
    const payload = backendPayload();
    if (!payload) {
      setState((s) => ({
        ...s,
        testResult: { success: false, message: 'Preencha todos os campos obrigatórios.' },
        status: 'error',
      }));
      return;
    }

    setState((s) => ({ ...s, isTesting: true, testResult: null, status: 'validating' }));

    void (async () => {
      const startedAt = Date.now();
      try {
        await updateCredentialMut.mutateAsync(payload);
        const result = await testConnectionMut.mutateAsync({ channel: backendChannel });
        await Promise.all([
          utils.settings.integrations.list.invalidate(),
          utils.omni.listChannels.invalidate(),
        ]);
        setState((s) => ({
          ...s,
          isTesting: false,
          testResult: {
            success: result.connected,
            message: result.connected
              ? 'Credenciais salvas e conexão validada com sucesso.'
              : (result.error ?? 'Falha na verificação.'),
            latencyMs: Date.now() - startedAt,
          },
          status: result.connected ? 'ready' : 'error',
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Falha ao salvar/testar.';
        setState((s) => ({
          ...s,
          isTesting: false,
          testResult: { success: false, message },
          status: 'error',
        }));
      }
    })();
  }

  function handleActivate() {
    // O salvamento real acontece em handleTest. Aqui apenas marcamos
    // 'activated' para o fluxo do wizard.
    setState((s) => ({ ...s, isActivating: true }));
    setTimeout(() => {
      setState((s) => ({ ...s, isActivating: false, status: 'activated' }));
    }, 300);
  }

  function handleSelectChannel(type: ChannelType) {
    setState((s) => ({
      ...INITIAL_STATE,
      channelType: type,
    }));
  }

  function handleCredentialChange(key: string, value: string) {
    setState((s) => ({
      ...s,
      credentials: { ...s.credentials, [key]: value },
      credentialErrors: { ...s.credentialErrors, [key]: '' },
    }));
  }

  function handleToggleEvent(key: string) {
    setState((s) => ({
      ...s,
      selectedEvents: s.selectedEvents.includes(key)
        ? s.selectedEvents.filter((k) => k !== key)
        : [...s.selectedEvents, key],
    }));
  }

  function handleRoutingChange(key: string, value: string | boolean) {
    setState((s) => ({
      ...s,
      routingValues: { ...s.routingValues, [key]: value },
    }));
  }

  const channelDef = state.channelType
    ? CHANNEL_DEFINITIONS.find((d) => d.type === state.channelType)
    : null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(6px)',
            zIndex: 400,
          }}
        />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '90vw',
            maxWidth: 720,
            maxHeight: '88vh',
            display: 'flex',
            flexDirection: 'column',
            background: T.bg,
            borderRadius: T.r.xl,
            border: `1px solid ${T.glassBorder}`,
            boxShadow: T.shadow.xl,
            zIndex: 401,
            overflow: 'hidden',
            outline: 'none',
          }}
        >
          <DialogPrimitive.Title
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: 'hidden',
              clip: 'rect(0,0,0,0)',
              whiteSpace: 'nowrap',
              border: 0,
            }}
          >
            Assistente de conexão de canal
          </DialogPrimitive.Title>

          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 24px',
              borderBottom: `1px solid ${T.divider}`,
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: T.r.md,
                  background: T.primaryBg,
                  border: `1px solid ${T.primaryBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ico name={config?.icon ?? 'message'} size={18} color={T.primary} />
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary }}>
                  {config ? `Conectar ${config.label}` : 'Conectar Canal'}
                </p>
                <p style={{ fontSize: 12, color: T.textMuted }}>
                  {currentStepDef?.description}
                </p>
              </div>
            </div>

            <DialogPrimitive.Close
              aria-label="Fechar wizard"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 6,
                borderRadius: T.r.sm,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Ico name="x" size={18} color={T.textMuted} />
            </DialogPrimitive.Close>
          </div>

          {/* Step indicator */}
          <div
            style={{
              display: 'flex',
              gap: 2,
              padding: '12px 24px',
              borderBottom: `1px solid ${T.divider}`,
              flexShrink: 0,
              overflowX: 'auto',
            }}
          >
            {WIZARD_STEPS.map((step, i) => {
              const isDone = i < stepIndex;
              const isCurrent = i === stepIndex;
              const isAccessible = i <= stepIndex;

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => isAccessible && setCurrentStep(step.id)}
                  disabled={!isAccessible}
                  aria-current={isCurrent ? 'step' : undefined}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    padding: '6px 4px',
                    background: 'none',
                    border: 'none',
                    cursor: isAccessible ? 'pointer' : 'default',
                    opacity: isAccessible ? 1 : 0.4,
                    outline: 'none',
                  }}
                >
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: isDone ? T.primaryGrad : isCurrent ? T.primaryBg : 'rgba(200,200,200,0.15)',
                      border: `1.5px solid ${isDone ? 'transparent' : isCurrent ? T.primary : T.divider}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {isDone ? (
                      <Ico name="check" size={13} color={T.textInverse} />
                    ) : (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: isCurrent ? T.primary : T.textMuted,
                        }}
                      >
                        {i + 1}
                      </span>
                    )}
                  </div>
                  <Mono
                    size={9}
                    color={isCurrent ? T.primary : T.textMuted}
                    style={{ textAlign: 'center', lineHeight: 1.2 }}
                  >
                    {step.label.toUpperCase()}
                  </Mono>
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px 24px',
            }}
          >
            {currentStep === 'channel' && (
              <ChannelSelector
                selectedType={state.channelType}
                onSelect={handleSelectChannel}
              />
            )}

            {currentStep === 'method' && config && (
              <ConnectionMethodSelector
                methods={config.connectionMethods}
                selected={state.connectionMethod}
                onSelect={(id) => setState((s) => ({
                  ...s,
                  connectionMethod: id,
                  credentials: {},
                  credentialErrors: {},
                }))}
              />
            )}

            {currentStep === 'credentials' && config && state.connectionMethod && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {state.channelType === 'whatsapp' && (
                  <WhatsAppConnectionConfig
                    connectionMethod={state.connectionMethod}
                    credentials={state.credentials}
                    onCredentialChange={handleCredentialChange}
                  />
                )}
                {state.channelType === 'instagram' && (
                  <InstagramConnectionConfig
                    connectionMethod={state.connectionMethod}
                    credentials={state.credentials}
                    onCredentialChange={handleCredentialChange}
                  />
                )}
                {state.channelType === 'facebook' && (
                  <FacebookConnectionConfig
                    connectionMethod={state.connectionMethod}
                    credentials={state.credentials}
                    onCredentialChange={handleCredentialChange}
                  />
                )}
                {state.channelType === 'email' && (
                  <EmailConnectionConfig
                    connectionMethod={state.connectionMethod}
                    credentials={state.credentials}
                    onCredentialChange={handleCredentialChange}
                  />
                )}
                {state.channelType === 'sms' && (
                  <SmsConnectionConfig
                    connectionMethod={state.connectionMethod}
                    credentials={state.credentials}
                    onCredentialChange={handleCredentialChange}
                  />
                )}
                {state.channelType === 'phone' && (
                  <PhoneConnectionConfig
                    connectionMethod={state.connectionMethod}
                    credentials={state.credentials}
                    onCredentialChange={handleCredentialChange}
                  />
                )}
                {state.channelType === 'webchat' && (
                  <WebchatConnectionConfig
                    connectionMethod={state.connectionMethod}
                    credentials={state.credentials}
                    onCredentialChange={handleCredentialChange}
                  />
                )}
                {state.channelType === 'custom' && (
                  <CustomChannelConnectionConfig
                    connectionMethod={state.connectionMethod}
                    credentials={state.credentials}
                    onCredentialChange={handleCredentialChange}
                  />
                )}
                {/* Para canais com backend real, o componente específico já
                    renderiza o formulário com os campos certos. Para os demais
                    (BSP, custom, webchat etc.) usamos o form genérico. */}
                {!backendChannel && (
                  <CredentialForm
                    fields={config.credentialFields[state.connectionMethod]}
                    values={state.credentials}
                    onChange={handleCredentialChange}
                    errors={state.credentialErrors}
                  />
                )}
              </div>
            )}

            {currentStep === 'webhook' && config && (
              <WebhookConfigPanel
                config={config.webhook}
                verifyToken={state.verifyToken}
                onVerifyTokenChange={(v) => setState((s) => ({ ...s, verifyToken: v }))}
                selectedEvents={state.selectedEvents}
                onToggleEvent={handleToggleEvent}
              />
            )}

            {currentStep === 'routing' && config && (
              <ChannelRoutingRules
                config={config.routing}
                values={state.routingValues}
                onChange={handleRoutingChange}
              />
            )}

            {currentStep === 'test' && config && (
              <TestConnectionDialog
                channelLabel={config.label}
                status={state.status}
                onTest={handleTest}
                testResult={state.testResult}
                isTesting={state.isTesting}
              />
            )}

            {currentStep === 'activation' && config && (
              <ActivationReview
                config={config}
                connectionMethod={state.connectionMethod}
                credentialValues={state.credentials}
                selectedEvents={state.selectedEvents}
                routingValues={state.routingValues}
                wizardStatus={state.status}
                onActivate={handleActivate}
                isActivating={state.isActivating}
                hasBackendSupport={channelDef?.omniType !== null}
              />
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 24px',
              borderTop: `1px solid ${T.divider}`,
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {state.status !== 'draft' && (
                <StatusPill status={state.status} />
              )}
              <Mono size={10} color={T.textMuted}>
                Etapa {stepIndex + 1} de {WIZARD_STEPS.length}
              </Mono>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {stepIndex > 0 && state.status !== 'activated' && (
                <Btn small variant="ghost" icon="arrowLeft" onClick={goBack}>
                  Voltar
                </Btn>
              )}

              {currentStep !== 'activation' && (
                <Btn
                  small
                  variant="primary"
                  icon="arrowRight"
                  onClick={goNext}
                  disabled={!canAdvance()}
                >
                  Avançar
                </Btn>
              )}

              {state.status === 'activated' && (
                <Btn
                  small
                  variant="primary"
                  icon="check"
                  onClick={() => onOpenChange(false)}
                >
                  Concluir
                </Btn>
              )}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ── Channel Selector (step 1) ───────────────────────────────────────

function ChannelSelector({
  selectedType,
  onSelect,
}: {
  selectedType: ChannelType | null;
  onSelect: (t: ChannelType) => void;
}) {
  const CATEGORY_ICON: Record<string, string> = {
    social: 'message',
    messaging: 'message',
    email: 'mail',
    voice: 'phone',
    web: 'globe',
    custom: 'layers',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontSize: 15, color: T.textPrimary, fontWeight: 600 }}>
        Selecione o canal
      </p>
      <p style={{ fontSize: 13, color: T.textSecondary, marginBottom: 4 }}>
        Escolha o canal de comunicação que deseja conectar ao ElosMed.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 10,
        }}
      >
        {CHANNEL_DEFINITIONS.map((ch) => {
          const isSelected = selectedType === ch.type;
          return (
            <button
              key={ch.type}
              type="button"
              onClick={() => onSelect(ch.type)}
              aria-pressed={isSelected}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                borderRadius: T.r.lg,
                background: isSelected ? T.primaryBg : T.glass,
                border: `1.5px solid ${isSelected ? T.primary : T.glassBorder}`,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.18s ease',
                outline: 'none',
                boxShadow: isSelected ? `0 0 0 3px ${T.primaryRing}` : 'none',
              }}
              onFocus={(e) => {
                if (!isSelected) e.currentTarget.style.boxShadow = `0 0 0 3px ${T.primaryRing}`;
              }}
              onBlur={(e) => {
                if (!isSelected) e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div
                aria-hidden
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: T.r.md,
                  background: isSelected ? T.primaryBg : 'rgba(200,200,200,0.12)',
                  border: `1px solid ${isSelected ? T.primaryBorder : T.divider}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Ico
                  name={CATEGORY_ICON[ch.category] as any}
                  size={16}
                  color={isSelected ? T.primary : T.textMuted}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>
                  {ch.label}
                </p>
                <Mono size={9} color={T.textMuted}>{ch.provider}</Mono>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Status pill ─────────────────────────────────────────────────────

function StatusPill({ status }: { status: WizardStatus }) {
  const map: Record<WizardStatus, { label: string; bg: string; border: string; color: string }> = {
    draft:      { label: 'Rascunho',   bg: T.glass,     border: T.glassBorder,   color: T.textMuted },
    validating: { label: 'Validando',  bg: T.primaryBg, border: T.primaryBorder, color: T.primary },
    error:      { label: 'Erro',       bg: T.dangerBg,  border: T.dangerBorder,  color: T.danger },
    ready:      { label: 'Pronto',     bg: T.successBg, border: T.successBorder, color: T.success },
    activated:  { label: 'Ativado',    bg: T.successBg, border: T.successBorder, color: T.success },
  };
  const s = map[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 10px',
        borderRadius: T.r.pill,
        background: s.bg,
        border: `1px solid ${s.border}`,
        fontSize: 11,
        fontWeight: 500,
        color: s.color,
      }}
    >
      {s.label}
    </span>
  );
}
