'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, useToast } from '@dermaos/ui';
import { Btn, Glass, PageHero } from '@dermaos/ui/ds';
import {
  createAgentSchema,
  type CreateAgentInput,
  type AiAgentType,
  type AiAgentModel,
} from '@dermaos/shared';
import { trpc } from '@/lib/trpc-provider';

const TYPE_OPTIONS: Array<{ value: AiAgentType; label: string; hint: string }> = [
  { value: 'receptionist', label: 'Recepcionista', hint: 'Recebe, tria, encaminha para agenda ou humano' },
  { value: 'scheduler',    label: 'Agendamento',   hint: 'Consulta horários, agenda e confirma consultas' },
  { value: 'follow_up',    label: 'Follow-up',     hint: 'Pós-atendimento, lembretes e acompanhamento' },
  { value: 'support',      label: 'Suporte',       hint: 'Dúvidas gerais, procedimentos e clínica' },
  { value: 'custom',       label: 'Personalizado', hint: 'Configuração livre' },
];

const MODEL_OPTIONS: Array<{ value: AiAgentModel; label: string; hint: string }> = [
  { value: 'claude-haiku-4-5',         label: 'Claude Haiku 4.5',      hint: 'Rápido e econômico — ideal para recepção' },
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4',       hint: 'Raciocínio mais rico — casos complexos' },
  { value: 'ollama:llama3.1:8b',       label: 'Ollama Llama 3.1 (local)', hint: 'Local, sem custo externo' },
];

function FormField({
  label,
  required,
  error,
  children,
  hint,
}: {
  label:    string;
  required?: boolean;
  error?:   string;
  children: React.ReactNode;
  hint?:    string;
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
        <p className="text-xs text-danger-700 flex items-center gap-1" role="alert">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

export default function NovoAgentePage() {
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<CreateAgentInput>({
    resolver: zodResolver(createAgentSchema),
    mode: 'onChange',
    defaultValues: {
      name:         '',
      type:         'receptionist',
      model:        'claude-haiku-4-5',
      systemPrompt: '',
      temperature:  0.3,
      maxTokens:    800,
      toolsEnabled: [],
      config:       { escalation_rules: [] },
    },
  });

  const createMutation = trpc.aurora.admin.create.useMutation({
    onSuccess: (res) => {
      toast.success('Agente criado', {
        description: 'Configure o prompt, canais e regras antes de ativar.',
      });
      void utils.aurora.admin.list.invalidate();
      router.push(`/comunicacoes/agentes/${res.agent.id}`);
    },
    onError: (err) => {
      toast.error('Falha ao criar agente', { description: err.message });
    },
  });

  const onSubmit = handleSubmit((values) => {
    createMutation.mutate(values);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '20px 26px 12px', flexShrink: 0 }}>
        <PageHero
          eyebrow="AURORA · NOVO AGENTE"
          title="Novo agente"
          module="aiMod"
          icon="zap"
          description="Crie um agente da Aurora. Ele começa inativo — configure tudo antes de ligar."
          actions={
            <Link href="/comunicacoes/agentes" style={{ textDecoration: 'none' }}>
              <Btn variant="glass" small icon="arrowLeft">Voltar</Btn>
            </Link>
          }
        />
      </div>

      <form onSubmit={onSubmit} style={{ flex: 1, overflowY: 'auto', padding: '0 26px 22px' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Glass style={{ padding: 24 }}>
            <div className="flex flex-col gap-4">
              <FormField
                label="Nome do agente"
                required
                error={errors.name?.message}
                hint="Ex.: Recepcionista WhatsApp, Aurora Pós-atendimento"
              >
                <input
                  {...register('name')}
                  className={[
                    'w-full rounded-md border bg-background px-3 py-2 text-sm',
                    'focus:outline-none focus:ring-2 focus:ring-ring',
                    errors.name ? 'border-danger-500' : 'border-input',
                  ].join(' ')}
                  placeholder="Aurora Recepção"
                />
              </FormField>

              <FormField label="Tipo" required error={errors.type?.message}>
                <Controller
                  control={control}
                  name="type"
                  render={({ field }) => (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {TYPE_OPTIONS.map((opt) => (
                        <label
                          key={opt.value}
                          className={[
                            'cursor-pointer rounded-md border p-3 text-sm transition-colors',
                            field.value === opt.value
                              ? 'border-primary-500 bg-primary-100 ring-1 ring-primary-500'
                              : 'border-input hover:border-primary-300',
                          ].join(' ')}
                        >
                          <input
                            type="radio"
                            className="sr-only"
                            value={opt.value}
                            checked={field.value === opt.value}
                            onChange={() => field.onChange(opt.value)}
                          />
                          <div className="font-medium text-foreground">{opt.label}</div>
                          <div className="text-xs text-muted-foreground">{opt.hint}</div>
                        </label>
                      ))}
                    </div>
                  )}
                />
              </FormField>

              <FormField label="Modelo" required error={errors.model?.message}>
                <Controller
                  control={control}
                  name="model"
                  render={({ field }) => (
                    <div className="flex flex-col gap-2">
                      {MODEL_OPTIONS.map((opt) => (
                        <label
                          key={opt.value}
                          className={[
                            'cursor-pointer rounded-md border p-3 text-sm transition-colors flex items-start gap-3',
                            field.value === opt.value
                              ? 'border-primary-500 bg-primary-100 ring-1 ring-primary-500'
                              : 'border-input hover:border-primary-300',
                          ].join(' ')}
                        >
                          <input
                            type="radio"
                            className="mt-0.5"
                            value={opt.value}
                            checked={field.value === opt.value}
                            onChange={() => field.onChange(opt.value)}
                          />
                          <div>
                            <div className="font-medium text-foreground">{opt.label}</div>
                            <div className="text-xs text-muted-foreground">{opt.hint}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                />
              </FormField>
            </div>
          </Glass>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingTop: 8 }}>
            <Link href="/comunicacoes/agentes" style={{ textDecoration: 'none' }}>
              <Btn type="button" variant="ghost" small>Cancelar</Btn>
            </Link>
            <Btn
              type="submit"
              small
              icon="check"
              disabled={!isValid}
              loading={createMutation.isPending}
            >
              {createMutation.isPending ? 'Criando…' : 'Criar agente'}
            </Btn>
          </div>
        </div>
      </form>
    </div>
  );
}
