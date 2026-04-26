'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Play, Power, Save, Trash2, AlertTriangle } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  DestructiveDialog,
  Switch,
  TabsRoot,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToast,
} from '@dermaos/ui';
import {
  updateAgentSchema,
  aiAgentToolSchema,
  type UpdateAgentInput,
  type AiAgentTool,
  type OperatingHours,
} from '@dermaos/shared';
import { trpc } from '@/lib/trpc-provider';
import { usePermission } from '@/lib/auth';

const TOOLS: Array<{ id: AiAgentTool; label: string; hint: string }> = [
  { id: 'consultarHorarios',         label: 'Consultar horários',      hint: 'Busca slots disponíveis na agenda' },
  { id: 'reservarSlot',              label: 'Reservar slot',           hint: 'Cria hold de 15 minutos' },
  { id: 'confirmarAgendamento',      label: 'Confirmar agendamento',   hint: 'Promove hold em agendamento definitivo' },
  { id: 'cancelarAgendamento',       label: 'Cancelar agendamento',    hint: 'Cancela consulta agendada' },
  { id: 'buscarAppointmentDoContato', label: 'Buscar agendamentos',     hint: 'Consulta agendamentos do contato' },
  { id: 'consultarKnowledgeBase',    label: 'Knowledge Base',          hint: 'Busca nos documentos da clínica' },
  { id: 'transferirParaHumano',      label: 'Transferir para humano',  hint: 'Encerra automação e escala' },
];

const HOURS_REGEX = /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/;

const DAY_LABELS: Array<{ key: keyof OperatingHours; label: string }> = [
  { key: 'mon', label: 'Segunda' },
  { key: 'tue', label: 'Terça'   },
  { key: 'wed', label: 'Quarta'  },
  { key: 'thu', label: 'Quinta'  },
  { key: 'fri', label: 'Sexta'   },
  { key: 'sat', label: 'Sábado'  },
  { key: 'sun', label: 'Domingo' },
];

export default function AgentEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const canConfigure = usePermission('omni', 'ai_config');

  const { data, isLoading } = trpc.aurora.admin.get.useQuery({ id });
  const agent = data?.agent;

  const [tab, setTab] = React.useState<'geral' | 'prompt' | 'canais'>('geral');
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<UpdateAgentInput>({
    resolver: zodResolver(updateAgentSchema),
    defaultValues: { id },
  });

  React.useEffect(() => {
    if (!agent) return;
    reset({
      id,
      name:         agent.name,
      type:         agent.type,
      model:        agent.model,
      systemPrompt: agent.systemPrompt ?? '',
      temperature:  agent.temperature,
      maxTokens:    agent.maxTokens,
      toolsEnabled: agent.toolsEnabled,
      config:       agent.config,
    });
  }, [agent, id, reset]);

  const updateMutation = trpc.aurora.admin.update.useMutation({
    onSuccess: () => {
      toast.success('Alterações salvas');
      void utils.aurora.admin.get.invalidate({ id });
      void utils.aurora.admin.list.invalidate();
    },
    onError: (err) => {
      toast.error('Falha ao salvar', { description: err.message });
    },
  });

  const toggleMutation = trpc.aurora.admin.toggle.useMutation({
    onSuccess: (res) => {
      toast.success(res.agent.isActive ? 'Agente ativado' : 'Agente desativado');
      void utils.aurora.admin.get.invalidate({ id });
      void utils.aurora.admin.list.invalidate();
    },
    onError: (err) => {
      toast.error('Falha ao alterar status', { description: err.message });
    },
  });

  const deleteMutation = trpc.aurora.admin.delete.useMutation({
    onSuccess: () => {
      toast.success('Agente removido');
      void utils.aurora.admin.list.invalidate();
      router.push('/comunicacoes/agentes');
    },
    onError: (err) => {
      toast.error('Falha ao remover', { description: err.message });
    },
  });

  const previewMutation = trpc.aurora.admin.preview.useMutation();

  const onSubmit = handleSubmit((values) => {
    updateMutation.mutate(values);
  });

  const [previewInput, setPreviewInput] = React.useState('');
  const [previewText, setPreviewText] = React.useState<string | null>(null);

  async function runPreview() {
    const msg = previewInput.trim();
    if (!msg) return;
    setPreviewText(null);
    try {
      const res = await previewMutation.mutateAsync({
        id,
        messages: [{ role: 'user', content: msg }],
      });
      setPreviewText(res.text);
    } catch (err: unknown) {
      toast.error('Preview indisponível', {
        description: (err as Error)?.message ?? 'Tente novamente.',
      });
    }
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  }
  if (!agent) {
    return <div className="p-6 text-sm text-muted-foreground">Agente não encontrado.</div>;
  }

  const watchedTools = watch('toolsEnabled') ?? [];
  const watchedHours = watch('config.operating_hours') ?? {};

  return (
    <div className="p-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <TabsRoot value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <TabsList>
              <TabsTrigger value="geral">Geral</TabsTrigger>
              <TabsTrigger value="prompt">Prompt</TabsTrigger>
              <TabsTrigger value="canais">Canais</TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              {canConfigure && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    toggleMutation.mutate({ id, isActive: !agent.isActive })
                  }
                  disabled={toggleMutation.isPending}
                >
                  <Power className="h-4 w-4" aria-hidden="true" />
                  {agent.isActive ? 'Desativar' : 'Ativar'}
                </Button>
              )}
              {canConfigure && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteOpen(true)}
                  className="text-danger-700 border-danger-500/30 hover:bg-danger-100"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Remover
                </Button>
              )}
              <Button
                type="submit"
                size="sm"
                disabled={!canConfigure || !isDirty || updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="h-4 w-4" aria-hidden="true" />
                )}
                Salvar
              </Button>
            </div>
          </div>

          {/* ── Geral ────────────────────────────────────────────────── */}
          <TabsContent value="geral">
            <Card>
              <CardContent className="flex flex-col gap-4 p-6">
                <div>
                  <label className="text-sm font-medium">Nome</label>
                  <input
                    {...register('name')}
                    disabled={!canConfigure}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  {errors.name && (
                    <p className="text-xs text-danger-700 mt-1">{errors.name.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Tipo</label>
                    <select
                      {...register('type')}
                      disabled={!canConfigure}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="receptionist">Recepcionista</option>
                      <option value="scheduler">Agendamento</option>
                      <option value="follow_up">Follow-up</option>
                      <option value="support">Suporte</option>
                      <option value="custom">Personalizado</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Modelo</label>
                    <select
                      {...register('model')}
                      disabled={!canConfigure}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="claude-haiku-4-5">Claude Haiku 4.5</option>
                      <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                      <option value="ollama:llama3.1:8b">Ollama Llama 3.1</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">
                      Temperature: {watch('temperature')?.toFixed(2) ?? '0.30'}
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      {...register('temperature', { valueAsNumber: true })}
                      disabled={!canConfigure}
                      className="mt-2 w-full"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      0 = determinístico · 1 = criativo
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Max tokens</label>
                    <input
                      type="number"
                      min={100}
                      max={2000}
                      step={50}
                      {...register('maxTokens', { valueAsNumber: true })}
                      disabled={!canConfigure}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    <p className="text-xs text-muted-foreground mt-1">100 – 2000</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Tools habilitadas</label>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {TOOLS.map((tool) => {
                      const checked = watchedTools.includes(tool.id);
                      return (
                        <label
                          key={tool.id}
                          className={[
                            'flex items-start gap-2 rounded-md border p-2.5 text-sm cursor-pointer',
                            checked ? 'border-primary-500 bg-primary-100' : 'border-input',
                            !canConfigure ? 'opacity-60 cursor-not-allowed' : '',
                          ].join(' ')}
                        >
                          <Controller
                            control={control}
                            name="toolsEnabled"
                            render={({ field }) => (
                              <input
                                type="checkbox"
                                className="mt-1"
                                disabled={!canConfigure}
                                checked={checked}
                                onChange={(e) => {
                                  const set = new Set(field.value ?? []);
                                  if (e.target.checked) set.add(tool.id);
                                  else set.delete(tool.id);
                                  field.onChange(Array.from(set));
                                }}
                              />
                            )}
                          />
                          <div>
                            <div className="font-medium text-foreground">{tool.label}</div>
                            <div className="text-xs text-muted-foreground">{tool.hint}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {aiAgentToolSchema.options.length} tools disponíveis. Ative apenas o necessário.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Prompt ──────────────────────────────────────────────── */}
          <TabsContent value="prompt">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardContent className="flex flex-col gap-2 p-6">
                  <label className="text-sm font-medium">System prompt</label>
                  <textarea
                    {...register('systemPrompt')}
                    disabled={!canConfigure}
                    rows={18}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                    placeholder="Você é Aurora, assistente virtual da clínica…"
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{(watch('systemPrompt') ?? '').length} / 16000 caracteres</span>
                    {errors.systemPrompt && (
                      <span className="text-danger-700">{errors.systemPrompt.message}</span>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex flex-col gap-3 p-6">
                  <div>
                    <label className="text-sm font-medium">Testar agente</label>
                    <p className="text-xs text-muted-foreground">
                      Preview local — não envia mensagens reais, não consome quota.
                    </p>
                  </div>
                  <textarea
                    value={previewInput}
                    onChange={(e) => setPreviewInput(e.target.value)}
                    rows={3}
                    placeholder="Olá, quero marcar uma consulta…"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      onClick={runPreview}
                      disabled={!previewInput.trim() || previewMutation.isPending}
                    >
                      {previewMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Play className="h-4 w-4" aria-hidden="true" />
                      )}
                      Rodar preview
                    </Button>
                  </div>
                  {previewText && (
                    <div className="rounded-md border border-border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
                      {previewText}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Canais ──────────────────────────────────────────────── */}
          <TabsContent value="canais">
            <div className="flex flex-col gap-4">
              <ChannelsLinker agentId={id} linkedIds={agent.channelIds} canConfigure={canConfigure} />

              <Card>
                <CardContent className="flex flex-col gap-3 p-6">
                  <div>
                    <h3 className="text-sm font-semibold">Horário de operação</h3>
                    <p className="text-xs text-muted-foreground">
                      Fora do horário, a Aurora encaminha direto para humano.
                      Deixe em branco para atender 24/7.
                    </p>
                  </div>
                  <Controller
                    control={control}
                    name="config.operating_hours"
                    render={({ field }) => (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {DAY_LABELS.map(({ key, label }) => {
                          const raw = (field.value as OperatingHours | undefined)?.[key];
                          const invalid = Boolean(raw) && !HOURS_REGEX.test(raw ?? '');
                          return (
                            <div key={key} className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <span className="w-20 text-sm text-muted-foreground">{label}</span>
                                <input
                                  type="text"
                                  value={raw ?? ''}
                                  placeholder="08:00-18:00"
                                  disabled={!canConfigure}
                                  aria-invalid={invalid}
                                  onChange={(e) => {
                                    const v = e.target.value.trim();
                                    const next = { ...(field.value as Record<string, string | null>) };
                                    if (v === '') delete next[key];
                                    else next[key] = v;
                                    field.onChange(next);
                                  }}
                                  className={[
                                    'flex-1 rounded-md border bg-background px-2 py-1 text-sm',
                                    invalid ? 'border-danger-500' : 'border-input',
                                  ].join(' ')}
                                />
                              </div>
                              {invalid && (
                                <p className="text-xs text-danger-700 pl-[5.5rem]" role="alert">
                                  Formato inválido — use HH:mm-HH:mm.
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    Formato <code>HH:mm-HH:mm</code> (ex.: <code>08:00-18:00</code>). Deixe vazio para fechado no dia.
                  </p>
                  {watchedHours && Object.keys(watchedHours).length === 0 && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                      Sem horário configurado — a Aurora atende 24/7.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </TabsRoot>
      </form>

      <DestructiveDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Remover agente"
        description="Esta ação desvincula todos os canais e arquiva o agente. Não é possível desfazer."
        confirmLabel="Remover agente"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          deleteMutation.mutate({ id });
          setDeleteOpen(false);
        }}
      />
    </div>
  );
}

/* ── Vinculador de canais ──────────────────────────────────────────────── */

function ChannelsLinker({
  agentId,
  linkedIds,
  canConfigure,
}: {
  agentId:      string;
  linkedIds:    string[];
  canConfigure: boolean;
}) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const { data } = trpc.omni.listChannels.useQuery();
  const channels = data?.channels ?? [];

  const linkMutation = trpc.aurora.admin.linkChannel.useMutation({
    onSuccess: () => {
      void utils.aurora.admin.get.invalidate();
      void utils.aurora.admin.list.invalidate();
    },
    onError: (err) => {
      toast.error('Falha ao vincular canal', { description: err.message });
    },
  });

  const unlinkMutation = trpc.aurora.admin.unlinkChannel.useMutation({
    onSuccess: () => {
      void utils.aurora.admin.get.invalidate();
      void utils.aurora.admin.list.invalidate();
    },
    onError: (err) => {
      toast.error('Falha ao desvincular canal', { description: err.message });
    },
  });

  const linkedSet = new Set(linkedIds);

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-6">
        <div>
          <h3 className="text-sm font-semibold">Canais vinculados</h3>
          <p className="text-xs text-muted-foreground">
            Cada canal pode ser atendido por apenas um agente.
          </p>
        </div>
        {channels.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum canal cadastrado.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {channels.map((ch) => {
              const linked = linkedSet.has(ch.id);
              const busy =
                (linkMutation.isPending && linkMutation.variables?.channelId === ch.id) ||
                (unlinkMutation.isPending && unlinkMutation.variables?.channelId === ch.id);
              return (
                <li
                  key={ch.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border p-3"
                >
                  <div>
                    <div className="text-sm font-medium">{ch.name}</div>
                    <div className="text-xs text-muted-foreground">{ch.type}</div>
                  </div>
                  <Switch
                    checked={linked}
                    disabled={!canConfigure || busy}
                    onCheckedChange={(checked) => {
                      if (checked) linkMutation.mutate({ agentId, channelId: ch.id });
                      else unlinkMutation.mutate({ channelId: ch.id });
                    }}
                    aria-label={linked ? `Desvincular ${ch.name}` : `Vincular ${ch.name}`}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
