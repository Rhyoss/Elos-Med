'use client';

import * as React from 'react';
import { Btn, Ico, Glass, Mono, T } from '@dermaos/ui/ds';
import type { WizardStatus } from '../../_lib/wizard-config';

interface TestConnectionDialogProps {
  channelLabel: string;
  status: WizardStatus;
  onTest: () => void;
  testResult: TestResult | null;
  isTesting: boolean;
}

export interface TestResult {
  success: boolean;
  message: string;
  details?: string;
  latencyMs?: number;
}

export function TestConnectionDialog({
  channelLabel,
  status,
  onTest,
  testResult,
  isTesting,
}: TestConnectionDialogProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <p style={{ fontSize: 15, color: T.textPrimary, fontWeight: 600, marginBottom: 4 }}>
          Testar conexão
        </p>
        <p style={{ fontSize: 13, color: T.textSecondary }}>
          Valide que as credenciais e configurações estão corretas antes de ativar o canal.
        </p>
      </div>

      <Glass style={{ padding: '24px 22px', textAlign: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          {!testResult && !isTesting && (
            <>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: T.primaryBg,
                  border: `1px solid ${T.primaryBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ico name="activity" size={24} color={T.primary} />
              </div>
              <p style={{ fontSize: 14, color: T.textSecondary }}>
                Clique para testar a conexão com <strong>{channelLabel}</strong>.
              </p>
              <Btn variant="primary" icon="zap" onClick={onTest}>
                Testar Conexão
              </Btn>
            </>
          )}

          {isTesting && (
            <>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: T.primaryBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    border: `3px solid ${T.primary}`,
                    borderTopColor: 'transparent',
                    animation: 'ds-spin 0.7s linear infinite',
                    display: 'inline-block',
                  }}
                />
              </div>
              <p style={{ fontSize: 14, color: T.textSecondary, fontWeight: 500 }}>
                Validando conexão...
              </p>
              <Mono size={10} color={T.textMuted}>
                Verificando credenciais e endpoint do provedor
              </Mono>
            </>
          )}

          {testResult && !isTesting && (
            <>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: testResult.success ? T.successBg : T.dangerBg,
                  border: `1px solid ${testResult.success ? T.successBorder : T.dangerBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ico
                  name={testResult.success ? 'check' : 'x'}
                  size={24}
                  color={testResult.success ? T.success : T.danger}
                />
              </div>

              <p
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: testResult.success ? T.success : T.danger,
                }}
              >
                {testResult.success ? 'Conexão estabelecida' : 'Falha na conexão'}
              </p>

              <p style={{ fontSize: 13, color: T.textSecondary }}>
                {testResult.message}
              </p>

              {testResult.latencyMs != null && testResult.success && (
                <Mono size={10} color={T.textMuted}>
                  Latência: {testResult.latencyMs}ms
                </Mono>
              )}

              {testResult.details && (
                <div
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: T.r.sm,
                    background: testResult.success ? T.successBg : T.dangerBg,
                    border: `1px solid ${testResult.success ? T.successBorder : T.dangerBorder}`,
                    fontSize: 12,
                    color: testResult.success ? T.success : T.danger,
                    textAlign: 'left',
                    fontFamily: "'IBM Plex Mono', monospace",
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {testResult.details}
                </div>
              )}

              <Btn
                small
                variant={testResult.success ? 'glass' : 'danger'}
                icon="zap"
                onClick={onTest}
              >
                Testar Novamente
              </Btn>
            </>
          )}
        </div>
      </Glass>

      {status === 'error' && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: T.r.md,
            background: T.dangerBg,
            border: `1px solid ${T.dangerBorder}`,
            fontSize: 12,
            color: T.danger,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Ico name="alert" size={14} color={T.danger} />
          O teste falhou. Verifique as credenciais na etapa anterior e tente novamente.
        </div>
      )}
    </div>
  );
}
