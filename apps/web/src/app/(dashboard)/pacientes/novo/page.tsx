'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Btn, Glass, Mono, Badge, Ico, PageHero, T, Field,
} from '@dermaos/ui/ds';
import { useToast } from '@dermaos/ui';
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

/* ── Glass form input ─────────────────────────────────────────────────── */

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 13px',
  borderRadius: T.r.md,
  background: T.inputBg,
  border: `1px solid ${T.inputBorder}`,
  fontSize: 15,
  color: T.textPrimary,
  fontFamily: "'IBM Plex Sans', sans-serif",
  transition: 'border-color 0.15s, box-shadow 0.15s',
  outline: 'none',
};

function inputErrorStyle(error?: string): React.CSSProperties {
  return {
    ...inputStyle,
    borderColor: error ? T.danger : T.inputBorder,
  };
}

/* ── Tags input ──────────────────────────────────────────────────────── */

function TagsInput({
  value,
  onChange,
  placeholder,
  label,
  variant = 'default',
}: {
  value:       string[];
  onChange:    (tags: string[]) => void;
  placeholder: string;
  label:       string;
  variant?:    'default' | 'danger' | 'warning' | 'info';
}) {
  const [input, setInput] = React.useState('');

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag || value.includes(tag)) { setInput(''); return; }
    onChange([...value, tag]);
    setInput('');
  }

  const badgeVariant = variant === 'default' ? 'default' : variant;

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
          style={{ ...inputStyle, flex: 1 }}
        />
        <Btn variant="glass" small icon="plus" onClick={() => addTag(input)} disabled={!input.trim()}>
          Adicionar
        </Btn>
      </div>
      {value.length > 0 && (
        <div role="list" aria-label={`Lista de ${label}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {value.map((tag) => (
            <Badge
              key={tag}
              variant={badgeVariant}
              dot={variant === 'danger'}
              style={{ fontSize: 13, padding: '3px 10px 3px 8px', gap: 5, cursor: 'default' }}
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
                  marginLeft: 2,
                }}
              >
                <Ico name="x" size={10} color="currentColor" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Duplicate modal ──────────────────────────────────────────────────── */

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
      <Glass
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 400,
          padding: '24px 20px',
          borderRadius: T.r.xl,
          boxShadow: '0 24px 56px rgba(0,0,0,0.12), 0 6px 14px rgba(0,0,0,0.06)',
        }}
      >
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
      </Glass>
    </div>
  );
}

/* ── Section wrapper ──────────────────────────────────────────────────── */

function FormSection({
  icon,
  title,
  subtitle,
  children,
  id,
}: {
  icon: 'user' | 'phone' | 'home' | 'activity' | 'globe' | 'shield' | 'layers';
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <Glass id={id} style={{ padding: '22px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: T.r.md,
            background: T.primaryBg,
            border: `1px solid ${T.primaryBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Ico name={icon} size={16} color={T.primary} />
        </div>
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: T.textPrimary, lineHeight: 1.2 }}>{title}</h2>
          {subtitle && <Mono size={10}>{subtitle}</Mono>}
        </div>
      </div>
      {children}
    </Glass>
  );
}

/* ── Progress indicator ───────────────────────────────────────────────── */

const SECTIONS = [
  { id: 'pessoais',  label: 'Pessoais',  icon: 'user'     as const },
  { id: 'contato',   label: 'Contato',   icon: 'phone'    as const },
  { id: 'endereco',  label: 'Endereço',  icon: 'home'     as const },
  { id: 'clinico',   label: 'Clínico',   icon: 'activity' as const },
  { id: 'origem',    label: 'Origem',    icon: 'globe'    as const },
];

function SectionNav({ activeSection }: { activeSection: string }) {
  return (
    <nav
      aria-label="Seções do formulário"
      style={{
        display: 'flex',
        gap: 4,
        padding: '8px 0',
      }}
    >
      {SECTIONS.map((s) => {
        const isActive = activeSection === s.id;
        return (
          <a
            key={s.id}
            href={`#${s.id}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 10px',
              borderRadius: T.r.pill,
              background: isActive ? T.primaryBg : 'transparent',
              border: `1px solid ${isActive ? T.primaryBorder : 'transparent'}`,
              fontSize: 12,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? T.primary : T.textMuted,
              textDecoration: 'none',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            <Ico name={s.icon} size={12} color={isActive ? T.primary : T.textMuted} />
            {s.label}
          </a>
        );
      })}
    </nav>
  );
}

/* ── Main page ────────────────────────────────────────────────────────── */

export default function NovoPacientePage() {
  const router = useRouter();
  const { toast } = useToast();

  const [duplicate, setDuplicate] = React.useState<{ id: string; name: string } | null>(null);
  const [cepLoading, setCepLoading] = React.useState(false);
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [activeSection, setActiveSection] = React.useState('pessoais');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
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

  const utils = trpc.useUtils();
  const createMutation = trpc.patients.create.useMutation({
    onSuccess: () => {
      void utils.patients.list.invalidate();
    },
  });

  // Intersection observer for section tracking
  const formRef = React.useRef<HTMLFormElement>(null);
  React.useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const sections = form.querySelectorAll('[data-section]');
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = (entry.target as HTMLElement).dataset.section;
            if (id) setActiveSection(id);
          }
        }
      },
      { rootMargin: '-40% 0px -40% 0px', threshold: 0.1 },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

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
      setValue('address.zip',      digits,          { shouldValidate: true });
    } catch {
      // silently ignore
    } finally {
      setCepLoading(false);
    }
  }

  // Submit action ref
  const actionRef = React.useRef<'save' | 'save-schedule' | 'save-record'>('save-record');

  async function onSubmit(data: CreatePatientForm) {
    setGlobalError(null);
    try {
      const result = await createMutation.mutateAsync(data);

      if (result.isDuplicate) {
        setDuplicate({ id: result.existing.id, name: result.existing.name });
        return;
      }

      const newId = result.patient.id;
      toast.success('Paciente cadastrado', { description: result.patient.name });

      if (actionRef.current === 'save-schedule') {
        router.push(`/agenda?paciente=${newId}`);
      } else if (actionRef.current === 'save-record') {
        router.push(`/pacientes/${newId}/prontuario`);
      } else {
        router.push('/pacientes');
      }
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Erro ao cadastrar paciente.');
    }
  }

  // Count errors per section for error indicator
  const errorCount = Object.keys(errors).length;

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 26px 4px', flexShrink: 0 }}>
          <PageHero
            eyebrow="PRONTUÁRIO ELETRÔNICO · NOVO CADASTRO"
            title="Cadastro Completo"
            description="Preencha os dados do paciente — campos com * são obrigatórios"
            module="clinical"
            icon="user"
            actions={
              <Link href="/pacientes" style={{ textDecoration: 'none' }}>
                <Btn variant="glass" small icon="arrowLeft">Voltar</Btn>
              </Link>
            }
          />
          <SectionNav activeSection={activeSection} />
        </div>

        {/* Form */}
        <form
          ref={formRef}
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          aria-label="Formulário de cadastro de paciente"
          style={{ flex: 1, overflowY: 'auto', padding: '12px 26px 100px' }}
        >
          <div style={{ maxWidth: 740, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
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
                <p style={{ fontSize: 14, color: T.danger, flex: 1 }}>{globalError}</p>
                <button
                  type="button"
                  onClick={() => setGlobalError(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                  aria-label="Fechar alerta"
                >
                  <Ico name="x" size={12} color={T.danger} />
                </button>
              </div>
            )}

            {/* ── Dados Pessoais ──────────────────────────────────────── */}
            <div data-section="pessoais">
              <FormSection id="pessoais" icon="user" title="Dados Pessoais" subtitle="INFORMAÇÕES DE IDENTIFICAÇÃO">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <Field label="Nome completo" required error={errors.name?.message}>
                      <input
                        {...register('name')}
                        placeholder="Maria da Silva"
                        autoComplete="name"
                        autoFocus
                        style={inputErrorStyle(errors.name?.message)}
                      />
                    </Field>
                  </div>

                  <Field label="CPF" error={errors.cpf?.message} icon="shield">
                    <input
                      {...register('cpf')}
                      placeholder="00000000000"
                      maxLength={11}
                      inputMode="numeric"
                      style={inputErrorStyle(errors.cpf?.message)}
                    />
                  </Field>

                  <Field label="Data de nascimento" error={errors.birthDate?.message} icon="calendar">
                    <input
                      type="date"
                      max={new Date().toISOString().split('T')[0]}
                      {...register('birthDate')}
                      style={inputErrorStyle(errors.birthDate?.message)}
                    />
                  </Field>

                  <Field label="Sexo" error={errors.gender?.message}>
                    <select
                      {...register('gender')}
                      style={inputErrorStyle(errors.gender?.message)}
                    >
                      <option value="">Selecione…</option>
                      <option value="female">Feminino</option>
                      <option value="male">Masculino</option>
                      <option value="non_binary">Não-binário</option>
                      <option value="prefer_not_to_say">Prefiro não informar</option>
                      <option value="other">Outro</option>
                    </select>
                  </Field>

                  <Field label="Tipo sanguíneo" error={errors.bloodType?.message}>
                    <select
                      {...register('bloodType')}
                      style={inputErrorStyle(errors.bloodType?.message)}
                    >
                      <option value="">Não informado</option>
                      {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map((bt) => (
                        <option key={bt} value={bt}>{bt}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </FormSection>
            </div>

            {/* ── Contato ─────────────────────────────────────────────── */}
            <div data-section="contato">
              <FormSection id="contato" icon="phone" title="Contato" subtitle="TELEFONE E E-MAIL">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <Field label="Telefone principal" error={errors.phone?.message} icon="phone">
                    <input
                      {...register('phone')}
                      placeholder="11999999999"
                      inputMode="tel"
                      maxLength={11}
                      style={inputErrorStyle(errors.phone?.message)}
                    />
                  </Field>

                  <Field label="Telefone secundário" error={errors.phoneSecondary?.message}>
                    <input
                      {...register('phoneSecondary')}
                      placeholder="11988888888"
                      inputMode="tel"
                      maxLength={11}
                      style={inputErrorStyle(errors.phoneSecondary?.message)}
                    />
                  </Field>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <Field label="E-mail" error={errors.email?.message} icon="mail">
                      <input
                        {...register('email')}
                        type="email"
                        placeholder="maria@email.com"
                        autoComplete="email"
                        style={inputErrorStyle(errors.email?.message)}
                      />
                    </Field>
                  </div>
                </div>
              </FormSection>
            </div>

            {/* ── Endereço ────────────────────────────────────────────── */}
            <div data-section="endereco">
              <FormSection id="endereco" icon="home" title="Endereço" subtitle="LOCALIZAÇÃO DO PACIENTE">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14 }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <Field label="CEP">
                      <div style={{ position: 'relative' }}>
                        <input
                          {...register('address.zip', {
                            onBlur: (e) => fetchCep(e.target.value),
                          })}
                          placeholder="00000000"
                          maxLength={8}
                          inputMode="numeric"
                          disabled={cepLoading}
                          style={inputStyle}
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
                    </Field>
                  </div>

                  <div style={{ gridColumn: 'span 4' }}>
                    <Field label="Rua / Logradouro">
                      <input {...register('address.street')} placeholder="Rua das Flores" style={inputStyle} />
                    </Field>
                  </div>

                  <div style={{ gridColumn: 'span 1' }}>
                    <Field label="Número">
                      <input {...register('address.number')} placeholder="123" style={inputStyle} />
                    </Field>
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <Field label="Complemento">
                      <input {...register('address.complement')} placeholder="Apto 12" style={inputStyle} />
                    </Field>
                  </div>

                  <div style={{ gridColumn: 'span 3' }}>
                    <Field label="Bairro">
                      <input {...register('address.district')} placeholder="Centro" style={inputStyle} />
                    </Field>
                  </div>

                  <div style={{ gridColumn: 'span 4' }}>
                    <Field label="Cidade">
                      <input {...register('address.city')} placeholder="São Paulo" style={inputStyle} />
                    </Field>
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <Field label="Estado" error={errors.address?.state?.message}>
                      <input
                        {...register('address.state')}
                        placeholder="SP"
                        maxLength={2}
                        style={{
                          ...inputErrorStyle(errors.address?.state?.message),
                          textTransform: 'uppercase',
                        }}
                      />
                    </Field>
                  </div>
                </div>
              </FormSection>
            </div>

            {/* ── Dados Clínicos ───────────────────────────────────────── */}
            <div data-section="clinico">
              <FormSection id="clinico" icon="activity" title="Dados Clínicos" subtitle="INFORMAÇÕES MÉDICAS">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <Field label="Alergias" icon="alert">
                    <TagsInput
                      value={allergies}
                      onChange={(v) => setValue('allergies', v)}
                      placeholder="Ex: Penicilina, Dipirona…"
                      label="alergia"
                      variant="danger"
                    />
                  </Field>

                  <Field label="Condições crônicas">
                    <TagsInput
                      value={chronicConditions}
                      onChange={(v) => setValue('chronicConditions', v)}
                      placeholder="Ex: Diabetes tipo 2, Hipertensão…"
                      label="condição crônica"
                      variant="warning"
                    />
                  </Field>

                  <Field label="Medicamentos em uso">
                    <TagsInput
                      value={activeMedications}
                      onChange={(v) => setValue('activeMedications', v)}
                      placeholder="Ex: Metformina 850mg…"
                      label="medicamento"
                      variant="info"
                    />
                  </Field>

                  <Field label="Observações internas" error={errors.internalNotes?.message}>
                    <textarea
                      {...register('internalNotes')}
                      rows={3}
                      placeholder="Informações relevantes para a equipe clínica…"
                      style={{ ...inputStyle, resize: 'vertical' }}
                    />
                  </Field>
                </div>
              </FormSection>
            </div>

            {/* ── Origem ───────────────────────────────────────────────── */}
            <div data-section="origem">
              <FormSection id="origem" icon="globe" title="Origem" subtitle="CANAL DE CAPTAÇÃO">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <Field label="Canal de origem">
                    <select {...register('sourceChannel')} style={inputStyle}>
                      <option value="">Não informado</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="google">Google</option>
                      <option value="referral">Indicação</option>
                      <option value="walk_in">Presencial</option>
                      <option value="instagram">Instagram</option>
                      <option value="facebook">Facebook</option>
                      <option value="site">Site</option>
                    </select>
                  </Field>

                  <Field label="Campanha / UTM">
                    <input {...register('sourceCampaign')} placeholder="campanha-verao-2026" style={inputStyle} />
                  </Field>
                </div>
              </FormSection>
            </div>
          </div>
        </form>

        {/* ── Sticky action bar ────────────────────────────────────────── */}
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '12px 26px',
            borderTop: `1px solid ${T.divider}`,
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(16px) saturate(170%)',
            WebkitBackdropFilter: 'blur(16px) saturate(170%)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            zIndex: 10,
          }}
        >
          <div style={{ maxWidth: 740, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
            {/* Error count indicator */}
            {errorCount > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 10px',
                  borderRadius: T.r.pill,
                  background: T.dangerBg,
                  border: `1px solid ${T.dangerBorder}`,
                  fontSize: 12,
                  color: T.danger,
                  fontWeight: 600,
                }}
              >
                <Ico name="alert" size={12} color={T.danger} />
                {errorCount} {errorCount === 1 ? 'erro' : 'erros'}
              </div>
            )}

            {isDirty && errorCount === 0 && (
              <Mono size={11} color={T.textMuted}>Alterações não salvas</Mono>
            )}

            <div style={{ flex: 1 }} />

            <Link href="/pacientes" style={{ textDecoration: 'none' }}>
              <Btn variant="ghost" small disabled={isSubmitting}>
                Cancelar
              </Btn>
            </Link>

            <Btn
              variant="glass"
              small
              disabled={isSubmitting}
              onClick={() => {
                toast.success('Rascunho mantido', { description: 'Complete o cadastro quando quiser.' });
                router.push('/pacientes');
              }}
            >
              Completar depois
            </Btn>

            <Btn
              type="submit"
              variant="glass"
              small
              icon="calendar"
              loading={isSubmitting && actionRef.current === 'save-schedule'}
              disabled={isSubmitting}
              onClick={() => {
                actionRef.current = 'save-schedule';
                formRef.current?.requestSubmit();
              }}
            >
              Salvar e agendar
            </Btn>

            <Btn
              type="submit"
              small
              icon="check"
              loading={isSubmitting && actionRef.current === 'save-record'}
              disabled={isSubmitting}
              onClick={() => {
                actionRef.current = 'save-record';
                formRef.current?.requestSubmit();
              }}
            >
              Salvar e abrir prontuário
            </Btn>
          </div>
        </div>
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
