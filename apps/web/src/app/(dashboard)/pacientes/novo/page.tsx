'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Btn, Glass, Mono, Badge, Ico, PageHero, T,
} from '@dermaos/ui/ds';
import { Button, useToast } from '@dermaos/ui';
import { createPatientSchema } from '@dermaos/shared';
import { trpc } from '@/lib/trpc-provider';

type CreatePatientForm = z.infer<typeof createPatientSchema>;

interface ViaCepResponse {
  logradouro: string;
  bairro:     string;
  localidade: string;
  uf:         string;
  erro?:      boolean;
}

/* ── Glass form field ──────────────────────────────────────────────────── */

function GlassField({
  label,
  required,
  error,
  hint,
  children,
}: {
  label:     string;
  required?: boolean;
  error?:    string;
  hint?:     string;
  children:  React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary, letterSpacing: '0.3px' }}>
        {label}
        {required && <span style={{ color: T.danger, marginLeft: 2 }} aria-hidden>*</span>}
      </label>
      {children}
      {hint && !error && (
        <p style={{ fontSize: 12, color: T.textMuted }}>{hint}</p>
      )}
      {error && (
        <p role="alert" aria-live="polite" style={{ fontSize: 12, color: T.danger, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Ico name="alert" size={10} color={T.danger} />
          {error}
        </p>
      )}
    </div>
  );
}

const glassInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: T.r.md,
  background: T.glass,
  backdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
  WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
  border: `1px solid ${T.glassBorder}`,
  fontSize: 15,
  color: T.textPrimary,
  fontFamily: "'IBM Plex Sans', sans-serif",
  transition: 'border-color 0.15s, box-shadow 0.15s',
  outline: 'none',
};

const glassInputErrorStyle: React.CSSProperties = {
  ...glassInputStyle,
  borderColor: T.dangerBorder,
};

function GlassInput({
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return (
    <input
      {...props}
      style={error ? glassInputErrorStyle : glassInputStyle}
      aria-invalid={!!error}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = T.primaryBorder;
        e.currentTarget.style.boxShadow = `0 0 0 2px ${T.primaryBg}`;
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = error ? T.dangerBorder : T.glassBorder;
        e.currentTarget.style.boxShadow = 'none';
        props.onBlur?.(e);
      }}
    />
  );
}

function GlassSelect({
  error,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { error?: string }) {
  return (
    <select
      {...props}
      style={error ? glassInputErrorStyle : glassInputStyle}
      aria-invalid={!!error}
    >
      {children}
    </select>
  );
}

function GlassTextarea({
  error,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }) {
  return (
    <textarea
      {...props}
      style={{
        ...(error ? glassInputErrorStyle : glassInputStyle),
        resize: 'none',
      }}
      aria-invalid={!!error}
    />
  );
}

/* ── Tags input ──────────────────────────────────────────────────────── */

function TagsInput({
  value,
  onChange,
  placeholder,
  label,
}: {
  value:       string[];
  onChange:    (tags: string[]) => void;
  placeholder: string;
  label:       string;
}) {
  const [input, setInput] = React.useState('');

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag || value.includes(tag)) { setInput(''); return; }
    onChange([...value, tag]);
    setInput('');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(input); }
            if (e.key === 'Backspace' && !input && value.length > 0) onChange(value.slice(0, -1));
          }}
          placeholder={placeholder}
          aria-label={`Adicionar ${label}`}
          style={{ ...glassInputStyle, flex: 1 }}
        />
        <Btn variant="glass" small icon="plus" onClick={() => addTag(input)} disabled={!input.trim()}>
          Adicionar
        </Btn>
      </div>
      {value.length > 0 && (
        <div role="list" aria-label={`Lista de ${label}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {value.map((tag) => (
            <span
              key={tag}
              role="listitem"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 10px 3px 12px',
                borderRadius: T.r.lg,
                background: T.primaryBg,
                border: `1px solid ${T.primaryBorder}`,
                fontSize: 13,
                fontWeight: 500,
                color: T.primary,
              }}
            >
              {tag}
              <button
                type="button"
                onClick={() => onChange(value.filter((t) => t !== tag))}
                aria-label={`Remover ${tag}`}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 2,
                  display: 'flex',
                  borderRadius: '50%',
                }}
              >
                <Ico name="x" size={10} color={T.primary} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Duplicate modal (glassmorphism) ───────────────────────────────────── */

function DuplicateModal({
  existingName,
  onView,
  onDismiss,
}: {
  existingName: string;
  onView:       () => void;
  onDismiss:    () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dup-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        aria-hidden
        onClick={onDismiss}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 400,
          background: T.glass,
          backdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
          WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
          border: `1px solid ${T.glassBorder}`,
          borderRadius: T.r.xl,
          boxShadow: '0 24px 56px rgba(0,0,0,0.12), 0 6px 14px rgba(0,0,0,0.06)',
          padding: '24px 20px',
          overflow: 'hidden',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '44%',
            background: T.metalHighlight,
            borderRadius: `${T.r.xl}px ${T.r.xl}px 0 0`,
            pointerEvents: 'none',
            opacity: 0.18,
          }}
        />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: T.r.lg,
                background: T.warningBg,
                border: `1px solid ${T.warningBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Ico name="alert" size={20} color={T.warning} />
            </div>
            <div>
              <h2 id="dup-title" style={{ fontSize: 18, fontWeight: 700, color: T.textPrimary }}>
                Paciente já cadastrado
              </h2>
              <p style={{ fontSize: 14, color: T.textSecondary, marginTop: 6, lineHeight: 1.5 }}>
                Já existe um cadastro com este CPF: <strong>{existingName}</strong>.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Btn variant="ghost" small onClick={onDismiss}>É outra pessoa</Btn>
            <Btn small icon="eye" onClick={onView}>Ver cadastro</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Section wrapper ───────────────────────────────────────────────────── */

function FormSection({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: 'user' | 'phone' | 'home' | 'activity' | 'globe';
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Glass style={{ padding: '22px 24px' }}>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '44%',
          background: T.metalHighlight,
          borderRadius: `${T.r.lg}px ${T.r.lg}px 0 0`,
          pointerEvents: 'none',
          opacity: 0.12,
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: T.r.md,
              background: T.primaryBg,
              border: `1px solid ${T.primaryBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Ico name={icon} size={15} color={T.primary} />
          </div>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: T.textPrimary, lineHeight: 1.2 }}>{title}</h2>
            {subtitle && <Mono size={11}>{subtitle}</Mono>}
          </div>
        </div>
        {children}
      </div>
    </Glass>
  );
}

/* ── Main page ─────────────────────────────────────────────────────────── */

export default function NovoPacientePage() {
  const router = useRouter();
  const { toast } = useToast();

  const [duplicate, setDuplicate] = React.useState<{ id: string; name: string } | null>(null);
  const [cepLoading, setCepLoading] = React.useState(false);
  const [globalError, setGlobalError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<CreatePatientForm>({
    resolver: zodResolver(createPatientSchema),
    defaultValues: {
      allergies:         [],
      chronicConditions: [],
      activeMedications: [],
      portalEnabled:     false,
    },
  });

  const allergies         = watch('allergies')         ?? [];
  const chronicConditions = watch('chronicConditions') ?? [];
  const activeMedications = watch('activeMedications') ?? [];

  const createMutation = trpc.patients.create.useMutation({
    onSuccess: (result) => {
      if (result.isDuplicate) {
        setDuplicate({ id: result.existing.id, name: result.existing.name });
        return;
      }
      toast.success('Paciente cadastrado', { description: result.patient.name });
      router.push(`/pacientes/${result.patient.id}/prontuario`);
    },
    onError: (err) => setGlobalError(err.message),
  });

  async function fetchCep(cep: string) {
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const res  = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const json = (await res.json()) as ViaCepResponse;
      if (json.erro) return;
      setValue('address.street',   json.logradouro, { shouldValidate: true });
      setValue('address.district', json.bairro,     { shouldValidate: true });
      setValue('address.city',     json.localidade, { shouldValidate: true });
      setValue('address.state',    json.uf,         { shouldValidate: true });
      setValue('address.zip',      digits,           { shouldValidate: true });
    } catch {
      // silently ignore
    } finally {
      setCepLoading(false);
    }
  }

  async function onSubmit(data: CreatePatientForm) {
    setGlobalError(null);
    await createMutation.mutateAsync(data);
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div style={{ padding: '20px 26px 12px', flexShrink: 0 }}>
          <PageHero
            eyebrow="PRONTUÁRIO ELETRÔNICO · NOVO CADASTRO"
            title="Novo Paciente"
            description="Preencha os dados para cadastrar um novo paciente na clínica"
            module="clinical"
            icon="user"
            actions={
              <Link href="/pacientes" style={{ textDecoration: 'none' }}>
                <Btn variant="glass" small icon="arrowLeft">Voltar</Btn>
              </Link>
            }
          />
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          aria-label="Formulário de cadastro de paciente"
          style={{ flex: 1, overflowY: 'auto', padding: '0 26px 22px' }}
        >
          <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Global error */}
            {globalError && (
              <div
                role="alert"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 16px',
                  borderRadius: T.r.lg,
                  background: T.dangerBg,
                  border: `1px solid ${T.dangerBorder}`,
                }}
              >
                <Ico name="alert" size={16} color={T.danger} />
                <p style={{ fontSize: 14, color: T.danger }}>{globalError}</p>
              </div>
            )}

            {/* Dados Pessoais */}
            <FormSection icon="user" title="Dados Pessoais" subtitle="INFORMAÇÕES DE IDENTIFICAÇÃO">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <GlassField label="Nome completo" required error={errors.name?.message}>
                    <GlassInput
                      {...register('name')}
                      placeholder="Maria da Silva"
                      autoComplete="name"
                      error={errors.name?.message}
                    />
                  </GlassField>
                </div>

                <GlassField label="CPF" error={errors.cpf?.message} hint="Somente números (11 dígitos)">
                  <GlassInput
                    {...register('cpf')}
                    placeholder="00000000000"
                    maxLength={11}
                    inputMode="numeric"
                    error={errors.cpf?.message}
                  />
                </GlassField>

                <GlassField label="Data de nascimento" error={errors.birthDate?.message}>
                  <GlassInput
                    type="date"
                    max={new Date().toISOString().split('T')[0]}
                    {...register('birthDate')}
                    error={errors.birthDate?.message}
                  />
                </GlassField>

                <GlassField label="Sexo" error={errors.gender?.message}>
                  <GlassSelect {...register('gender')} error={errors.gender?.message}>
                    <option value="">Selecione…</option>
                    <option value="female">Feminino</option>
                    <option value="male">Masculino</option>
                    <option value="non_binary">Não-binário</option>
                    <option value="prefer_not_to_say">Prefiro não informar</option>
                    <option value="other">Outro</option>
                  </GlassSelect>
                </GlassField>

                <GlassField label="Tipo sanguíneo" error={errors.bloodType?.message}>
                  <GlassSelect {...register('bloodType')} error={errors.bloodType?.message}>
                    <option value="">Não informado</option>
                    {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map((bt) => (
                      <option key={bt} value={bt}>{bt}</option>
                    ))}
                  </GlassSelect>
                </GlassField>
              </div>
            </FormSection>

            {/* Contato */}
            <FormSection icon="phone" title="Contato" subtitle="TELEFONE E E-MAIL">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <GlassField label="Telefone principal" required error={errors.phone?.message} hint="DDD + número">
                  <GlassInput
                    {...register('phone')}
                    placeholder="11999999999"
                    inputMode="tel"
                    maxLength={11}
                    error={errors.phone?.message}
                  />
                </GlassField>

                <GlassField label="Telefone secundário" error={errors.phoneSecondary?.message}>
                  <GlassInput
                    {...register('phoneSecondary')}
                    placeholder="11988888888"
                    inputMode="tel"
                    maxLength={11}
                    error={errors.phoneSecondary?.message}
                  />
                </GlassField>

                <div style={{ gridColumn: '1 / -1' }}>
                  <GlassField label="E-mail" error={errors.email?.message}>
                    <GlassInput
                      {...register('email')}
                      type="email"
                      placeholder="maria@email.com"
                      autoComplete="email"
                      error={errors.email?.message}
                    />
                  </GlassField>
                </div>
              </div>
            </FormSection>

            {/* Endereço */}
            <FormSection icon="home" title="Endereço" subtitle="LOCALIZAÇÃO DO PACIENTE">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14 }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <GlassField label="CEP" hint="Preenchimento automático">
                    <div style={{ position: 'relative' }}>
                      <GlassInput
                        {...register('address.zip', {
                          onBlur: (e) => fetchCep(e.target.value),
                        })}
                        placeholder="00000000"
                        maxLength={8}
                        inputMode="numeric"
                        disabled={cepLoading}
                      />
                      {cepLoading && (
                        <span
                          aria-label="Buscando CEP…"
                          style={{
                            position: 'absolute',
                            right: 10,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            border: `2px solid ${T.primary}`,
                            borderTopColor: 'transparent',
                            animation: 'ds-spin 0.7s linear infinite',
                            display: 'inline-block',
                          }}
                        />
                      )}
                    </div>
                  </GlassField>
                </div>

                <div style={{ gridColumn: 'span 4' }}>
                  <GlassField label="Rua / Logradouro">
                    <GlassInput {...register('address.street')} placeholder="Rua das Flores" />
                  </GlassField>
                </div>

                <div style={{ gridColumn: 'span 1' }}>
                  <GlassField label="Número">
                    <GlassInput {...register('address.number')} placeholder="123" />
                  </GlassField>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <GlassField label="Complemento">
                    <GlassInput {...register('address.complement')} placeholder="Apto 12" />
                  </GlassField>
                </div>

                <div style={{ gridColumn: 'span 3' }}>
                  <GlassField label="Bairro">
                    <GlassInput {...register('address.district')} placeholder="Centro" />
                  </GlassField>
                </div>

                <div style={{ gridColumn: 'span 4' }}>
                  <GlassField label="Cidade">
                    <GlassInput {...register('address.city')} placeholder="São Paulo" />
                  </GlassField>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <GlassField label="Estado" error={errors.address?.state?.message}>
                    <GlassInput
                      {...register('address.state')}
                      placeholder="SP"
                      maxLength={2}
                      style={{ ...glassInputStyle, textTransform: 'uppercase' }}
                      error={errors.address?.state?.message}
                    />
                  </GlassField>
                </div>
              </div>
            </FormSection>

            {/* Dados Clínicos */}
            <FormSection icon="activity" title="Dados Clínicos" subtitle="INFORMAÇÕES MÉDICAS">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <GlassField label="Alergias" hint="Pressione Enter ou vírgula para adicionar">
                  <TagsInput
                    value={allergies}
                    onChange={(v) => setValue('allergies', v)}
                    placeholder="Ex: Penicilina, Dipirona…"
                    label="alergia"
                  />
                </GlassField>

                <GlassField label="Condições crônicas" hint="Ex: Diabetes, Hipertensão…">
                  <TagsInput
                    value={chronicConditions}
                    onChange={(v) => setValue('chronicConditions', v)}
                    placeholder="Ex: Diabetes tipo 2…"
                    label="condição crônica"
                  />
                </GlassField>

                <GlassField label="Medicamentos em uso" hint="Ex: Metformina 850mg…">
                  <TagsInput
                    value={activeMedications}
                    onChange={(v) => setValue('activeMedications', v)}
                    placeholder="Ex: Metformina 850mg…"
                    label="medicamento"
                  />
                </GlassField>

                <GlassField label="Observações internas" error={errors.internalNotes?.message}>
                  <GlassTextarea
                    {...register('internalNotes')}
                    rows={3}
                    placeholder="Informações relevantes para a equipe clínica…"
                    error={errors.internalNotes?.message}
                  />
                </GlassField>
              </div>
            </FormSection>

            {/* Origem */}
            <FormSection icon="globe" title="Origem" subtitle="CANAL DE CAPTAÇÃO">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <GlassField label="Canal de origem">
                  <GlassSelect {...register('sourceChannel')}>
                    <option value="">Não informado</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="google">Google</option>
                    <option value="referral">Indicação</option>
                    <option value="walk_in">Presencial</option>
                    <option value="instagram">Instagram</option>
                    <option value="facebook">Facebook</option>
                    <option value="site">Site</option>
                  </GlassSelect>
                </GlassField>

                <GlassField label="Campanha / UTM">
                  <GlassInput {...register('sourceCampaign')} placeholder="campanha-verao-2026" />
                </GlassField>
              </div>
            </FormSection>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingBottom: 16 }}>
              <Link href="/pacientes" style={{ textDecoration: 'none' }}>
                <Btn variant="ghost" small disabled={isSubmitting}>Cancelar</Btn>
              </Link>
              <Btn type="submit" small icon="check" loading={isSubmitting}>
                {isSubmitting ? 'Salvando…' : 'Salvar Paciente'}
              </Btn>
            </div>
          </div>
        </form>
      </div>

      {duplicate && (
        <DuplicateModal
          existingName={duplicate.name}
          onView={() => router.push(`/pacientes/${duplicate.id}/prontuario`)}
          onDismiss={() => setDuplicate(null)}
        />
      )}
    </>
  );
}
