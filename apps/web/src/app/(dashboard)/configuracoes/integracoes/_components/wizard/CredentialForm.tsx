'use client';

import * as React from 'react';
import { Input, Textarea, Select, Field, Ico, Mono, T } from '@dermaos/ui/ds';
import type { CredentialField } from '../../_lib/wizard-config';

interface CredentialFormProps {
  fields: CredentialField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  errors: Record<string, string>;
}

export function CredentialForm({ fields, values, onChange, errors }: CredentialFormProps) {
  const [revealed, setRevealed] = React.useState<Record<string, boolean>>({});

  if (fields.length === 0) {
    return (
      <div
        style={{
          padding: '24px 20px',
          borderRadius: T.r.lg,
          background: T.primaryBg,
          border: `1px solid ${T.primaryBorder}`,
          textAlign: 'center',
        }}
      >
        <Ico name="check" size={24} color={T.primary} />
        <p style={{ fontSize: 14, color: T.primary, fontWeight: 500, marginTop: 8 }}>
          Este método não requer credenciais manuais.
        </p>
        <p style={{ fontSize: 12, color: T.textSecondary, marginTop: 4 }}>
          A autenticação será feita automaticamente durante o processo de conexão.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <p style={{ fontSize: 15, color: T.textPrimary, fontWeight: 600, marginBottom: 4 }}>
          Credenciais de acesso
        </p>
        <p style={{ fontSize: 13, color: T.textSecondary }}>
          Preencha as credenciais do provedor. Dados sensíveis são criptografados (AES-256-GCM) antes de serem armazenados.
        </p>
      </div>

      <div
        style={{
          padding: '10px 14px',
          borderRadius: T.r.md,
          background: T.primaryBg,
          border: `1px solid ${T.primaryBorder}`,
          fontSize: 12,
          color: T.primary,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Ico name="shield" size={14} color={T.primary} />
        Credenciais nunca são salvas em localStorage. Tokens são mascarados após salvamento.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {fields.map((f) => {
          const isRevealed = revealed[f.key] ?? false;
          const isMasked = f.masked && f.type === 'password';

          return (
            <Field
              key={f.key}
              label={f.label}
              icon={f.masked ? 'lock' : undefined}
              error={errors[f.key]}
              required={f.required}
            >
              {f.type === 'select' ? (
                <Select
                  value={values[f.key] ?? ''}
                  onChange={(e) => onChange(f.key, e.target.value)}
                  error={!!errors[f.key]}
                >
                  <option value="">Selecione...</option>
                  {f.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </Select>
              ) : f.type === 'textarea' ? (
                <Textarea
                  value={values[f.key] ?? ''}
                  onChange={(e) => onChange(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  error={!!errors[f.key]}
                  rows={3}
                />
              ) : (
                <div style={{ position: 'relative' }}>
                  <Input
                    type={isMasked && !isRevealed ? 'password' : 'text'}
                    value={values[f.key] ?? ''}
                    onChange={(e) => onChange(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    error={!!errors[f.key]}
                    autoComplete="off"
                    spellCheck={false}
                    leadingIcon={f.masked ? 'lock' : undefined}
                    style={isMasked ? { paddingRight: 40 } : undefined}
                  />
                  {isMasked && (
                    <button
                      type="button"
                      onClick={() => setRevealed((p) => ({ ...p, [f.key]: !p[f.key] }))}
                      aria-label={isRevealed ? 'Ocultar valor' : 'Mostrar valor'}
                      style={{
                        position: 'absolute',
                        right: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 2,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <Ico name={isRevealed ? 'eye' : 'lock'} size={14} color={T.textMuted} />
                    </button>
                  )}
                </div>
              )}

              {f.helpText && (
                <Mono size={10} color={T.textMuted} style={{ marginTop: 4 }}>
                  {f.helpText}
                </Mono>
              )}
            </Field>
          );
        })}
      </div>
    </div>
  );
}
