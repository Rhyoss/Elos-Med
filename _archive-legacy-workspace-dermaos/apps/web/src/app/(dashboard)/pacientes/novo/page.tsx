'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, ChevronLeft, Loader2, Plus, X } from 'lucide-react';
import { PageHeader, Button, Badge, Card, CardContent } from '@dermaos/ui';
import { createPatientSchema } from '@dermaos/shared';
import { trpc } from '@/lib/trpc-provider';

/* ── Tipos ──────────────────────────────────────────────────────────────── */

type CreatePatientForm = z.infer<typeof createPatientSchema>;

interface ViaCepResponse {
  logradouro: string;
  bairro:     string;
  localidade: string;
  uf:         string;
  erro?:      boolean;
}

/* ── Componentes auxiliares ──────────────────────────────────────────────── */

function FormField({
  label,
  required,
  error,
  children,
  hint,
}: {
  label:     string;
  required?: boolean;
  error?:    string;
  children:  React.ReactNode;
  hint?:     string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-danger-500 ml-0.5" aria-hidden="true">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p className="text-xs text-danger-600 flex items-center gap-1" role="alert" aria-live="polite">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

function FieldInput({
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return (
    <input
      {...props}
      className={[
        'w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground',
        'focus:outline-none focus:ring-2 focus:ring-ring transition-colors',
        error ? 'border-danger-500' : 'border-input',
        props.disabled ? 'opacity-50 cursor-not-allowed' : '',
      ].join(' ')}
      aria-invalid={!!error}
    />
  );
}

function FieldSelect({
  error,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { error?: string }) {
  return (
    <select
      {...props}
      className={[
        'w-full rounded-md border bg-background px-3 py-2 text-sm',
        'focus:outline-none focus:ring-2 focus:ring-ring transition-colors',
        error ? 'border-danger-500' : 'border-input',
        props.disabled ? 'opacity-50 cursor-not-allowed' : '',
      ].join(' ')}
      aria-invalid={!!error}
    >
      {children}
    </select>
  );
}

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

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              addTag(input);
            }
            if (e.key === 'Backspace' && !input && value.length > 0) {
              onChange(value.slice(0, -1));
            }
          }}
          placeholder={placeholder}
          aria-label={`Adicionar ${label}`}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm
                     placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addTag(input)}
          aria-label={`Adicionar ${label}`}
          disabled={!input.trim()}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="list" aria-label={`Lista de ${label}`}>
          {value.map((tag) => (
            <span
              key={tag}
              role="listitem"
              className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary-100 px-2.5 py-0.5 text-xs font-medium text-primary-700"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                aria-label={`Remover ${tag}`}
                className="flex items-center justify-center rounded-full hover:bg-primary-200 p-0.5 focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Modal de duplicata ──────────────────────────────────────────────────── */

interface DuplicateModalProps {
  existingId:   string;
  existingName: string;
  onView:       () => void;
  onDismiss:    () => void;
}

function DuplicateModal({ existingId, existingName, onView, onDismiss }: DuplicateModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dup-title"
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    >
      <div className="bg-background rounded-xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning-100">
            <AlertCircle className="h-5 w-5 text-warning-600" aria-hidden="true" />
          </span>
          <div>
            <h2 id="dup-title" className="font-semibold text-foreground">Paciente já cadastrado</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Já existe um cadastro com este CPF: <strong>{existingName}</strong>.
            </p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onDismiss}>É outra pessoa</Button>
          <Button size="sm" onClick={onView}>Ver cadastro existente</Button>
        </div>
      </div>
    </div>
  );
}

/* ── Seções do formulário ────────────────────────────────────────────────── */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-semibold text-foreground border-b border-border pb-2 mb-4">
      {children}
    </h2>
  );
}

/* ── Página principal ────────────────────────────────────────────────────── */

export default function NovoPacientePage() {
  const router = useRouter();

  const [duplicate, setDuplicate] = React.useState<{ id: string; name: string } | null>(null);
  const [cepLoading, setCepLoading] = React.useState(false);
  const [globalError, setGlobalError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    getValues,
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
      router.push(`/pacientes/${result.patient.id}/perfil`);
    },
    onError: (err) => {
      setGlobalError(err.message);
    },
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
      // Silently ignore CEP lookup errors
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
      <div className="flex flex-col h-full">
        <PageHeader
          title="Novo Paciente"
          description="Preencha os dados para cadastrar um novo paciente"
          actions={
            <nav aria-label="Breadcrumb">
              <Link href="/pacientes" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Voltar para Pacientes
              </Link>
            </nav>
          }
        />

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          aria-label="Formulário de cadastro de paciente"
          className="flex-1 overflow-y-auto p-6"
        >
          <div className="max-w-3xl mx-auto flex flex-col gap-8">
            {/* Erro global */}
            {globalError && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger-500/30 bg-danger-50 px-4 py-3">
                <AlertCircle className="h-4 w-4 text-danger-600 shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-sm text-danger-700">{globalError}</p>
              </div>
            )}

            {/* SEÇÃO: Dados Pessoais */}
            <Card>
              <CardContent className="pt-6">
                <SectionTitle>Dados Pessoais</SectionTitle>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <FormField label="Nome completo" required error={errors.name?.message}>
                      <FieldInput
                        {...register('name')}
                        placeholder="Maria da Silva"
                        autoComplete="name"
                        error={errors.name?.message}
                      />
                    </FormField>
                  </div>

                  <FormField label="CPF" error={errors.cpf?.message} hint="Somente números (11 dígitos)">
                    <FieldInput
                      {...register('cpf', {
                        onBlur: () => {
                          const cpf = getValues('cpf');
                          if (cpf && cpf.length === 11) {
                            // Duplicata é verificada no servidor ao submeter
                          }
                        },
                      })}
                      placeholder="00000000000"
                      maxLength={11}
                      inputMode="numeric"
                      error={errors.cpf?.message}
                    />
                  </FormField>

                  <FormField label="Data de nascimento" error={errors.birthDate?.message}>
                    <FieldInput
                      type="date"
                      max={new Date().toISOString().split('T')[0]}
                      {...register('birthDate')}
                      error={errors.birthDate?.message}
                    />
                  </FormField>

                  <FormField label="Sexo" error={errors.gender?.message}>
                    <FieldSelect {...register('gender')} error={errors.gender?.message}>
                      <option value="">Selecione…</option>
                      <option value="female">Feminino</option>
                      <option value="male">Masculino</option>
                      <option value="non_binary">Não-binário</option>
                      <option value="prefer_not_to_say">Prefiro não informar</option>
                      <option value="other">Outro</option>
                    </FieldSelect>
                  </FormField>

                  <FormField label="Tipo sanguíneo" error={errors.bloodType?.message}>
                    <FieldSelect {...register('bloodType')} error={errors.bloodType?.message}>
                      <option value="">Não informado</option>
                      {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map((bt) => (
                        <option key={bt} value={bt}>{bt}</option>
                      ))}
                    </FieldSelect>
                  </FormField>
                </div>
              </CardContent>
            </Card>

            {/* SEÇÃO: Contato */}
            <Card>
              <CardContent className="pt-6">
                <SectionTitle>Contato</SectionTitle>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Telefone principal" required error={errors.phone?.message} hint="DDD + número (10 ou 11 dígitos)">
                    <FieldInput
                      {...register('phone')}
                      placeholder="11999999999"
                      inputMode="tel"
                      maxLength={11}
                      error={errors.phone?.message}
                    />
                  </FormField>

                  <FormField label="Telefone secundário" error={errors.phoneSecondary?.message}>
                    <FieldInput
                      {...register('phoneSecondary')}
                      placeholder="11988888888"
                      inputMode="tel"
                      maxLength={11}
                      error={errors.phoneSecondary?.message}
                    />
                  </FormField>

                  <div className="sm:col-span-2">
                    <FormField label="E-mail" error={errors.email?.message}>
                      <FieldInput
                        {...register('email')}
                        type="email"
                        placeholder="maria@email.com"
                        autoComplete="email"
                        error={errors.email?.message}
                      />
                    </FormField>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SEÇÃO: Endereço */}
            <Card>
              <CardContent className="pt-6">
                <SectionTitle>Endereço</SectionTitle>
                <div className="grid gap-4 sm:grid-cols-6">
                  <div className="sm:col-span-2">
                    <FormField label="CEP" hint="Preenchimento automático">
                      <div className="relative">
                        <FieldInput
                          {...register('address.zip', {
                            onBlur: (e) => fetchCep(e.target.value),
                          })}
                          placeholder="00000000"
                          maxLength={8}
                          inputMode="numeric"
                          disabled={cepLoading}
                        />
                        {cepLoading && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" aria-label="Buscando CEP…" />
                        )}
                      </div>
                    </FormField>
                  </div>

                  <div className="sm:col-span-4">
                    <FormField label="Rua / Logradouro">
                      <FieldInput {...register('address.street')} placeholder="Rua das Flores" />
                    </FormField>
                  </div>

                  <div className="sm:col-span-1">
                    <FormField label="Número">
                      <FieldInput {...register('address.number')} placeholder="123" />
                    </FormField>
                  </div>

                  <div className="sm:col-span-2">
                    <FormField label="Complemento">
                      <FieldInput {...register('address.complement')} placeholder="Apto 12" />
                    </FormField>
                  </div>

                  <div className="sm:col-span-3">
                    <FormField label="Bairro">
                      <FieldInput {...register('address.district')} placeholder="Centro" />
                    </FormField>
                  </div>

                  <div className="sm:col-span-4">
                    <FormField label="Cidade">
                      <FieldInput {...register('address.city')} placeholder="São Paulo" />
                    </FormField>
                  </div>

                  <div className="sm:col-span-2">
                    <FormField label="Estado" error={errors.address?.state?.message}>
                      <FieldInput
                        {...register('address.state')}
                        placeholder="SP"
                        maxLength={2}
                        style={{ textTransform: 'uppercase' }}
                        error={errors.address?.state?.message}
                      />
                    </FormField>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SEÇÃO: Dados Clínicos */}
            <Card>
              <CardContent className="pt-6">
                <SectionTitle>Dados Clínicos</SectionTitle>
                <div className="flex flex-col gap-5">
                  <FormField label="Alergias" hint="Pressione Enter ou vírgula para adicionar">
                    <TagsInput
                      value={allergies}
                      onChange={(v) => setValue('allergies', v)}
                      placeholder="Ex: Penicilina, Dipirona…"
                      label="alergia"
                    />
                  </FormField>

                  <FormField label="Condições crônicas" hint="Ex: Diabetes, Hipertensão…">
                    <TagsInput
                      value={chronicConditions}
                      onChange={(v) => setValue('chronicConditions', v)}
                      placeholder="Ex: Diabetes tipo 2…"
                      label="condição crônica"
                    />
                  </FormField>

                  <FormField label="Medicamentos em uso" hint="Ex: Metformina 850mg…">
                    <TagsInput
                      value={activeMedications}
                      onChange={(v) => setValue('activeMedications', v)}
                      placeholder="Ex: Metformina 850mg…"
                      label="medicamento"
                    />
                  </FormField>

                  <FormField label="Observações internas" error={errors.internalNotes?.message}>
                    <textarea
                      {...register('internalNotes')}
                      rows={3}
                      placeholder="Informações relevantes para a equipe clínica…"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                                 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                      aria-invalid={!!errors.internalNotes}
                    />
                    {errors.internalNotes && (
                      <p className="text-xs text-danger-600" role="alert">{errors.internalNotes.message}</p>
                    )}
                  </FormField>
                </div>
              </CardContent>
            </Card>

            {/* SEÇÃO: Origem */}
            <Card>
              <CardContent className="pt-6">
                <SectionTitle>Origem</SectionTitle>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Canal de origem">
                    <FieldSelect {...register('sourceChannel')}>
                      <option value="">Não informado</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="google">Google</option>
                      <option value="referral">Indicação</option>
                      <option value="walk_in">Presencial</option>
                      <option value="instagram">Instagram</option>
                      <option value="facebook">Facebook</option>
                      <option value="site">Site</option>
                    </FieldSelect>
                  </FormField>

                  <FormField label="Campanha / UTM">
                    <FieldInput {...register('sourceCampaign')} placeholder="campanha-verao-2025" />
                  </FormField>
                </div>
              </CardContent>
            </Card>

            {/* Ações */}
            <div className="flex items-center justify-end gap-3 pb-6">
              <Link href="/pacientes">
                <Button type="button" variant="ghost" disabled={isSubmitting}>Cancelar</Button>
              </Link>
              <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Salvando…
                  </>
                ) : 'Salvar Paciente'}
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* Modal de duplicata */}
      {duplicate && (
        <DuplicateModal
          existingId={duplicate.id}
          existingName={duplicate.name}
          onView={() => router.push(`/pacientes/${duplicate.id}/perfil`)}
          onDismiss={() => setDuplicate(null)}
        />
      )}
    </>
  );
}
