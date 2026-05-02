'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, SelectRoot, SelectTrigger, SelectValue, SelectContent,
  SelectItem, Switch, Label,
} from '@dermaos/ui';
import {
  createAutomationSchema,
  AUTOMATION_TRIGGERS,
  TRIGGER_META,
  type CreateAutomationInput,
  type AutomationTrigger,
} from '@dermaos/shared';
import { trpc } from '@/lib/trpc-provider';
import { TriggerInfo } from './trigger-info';
import { previewTemplate } from '@/lib/template-preview';

interface AutomationModalProps {
  open:     boolean;
  onClose:  () => void;
  onSaved:  () => void;
}

export function AutomationModal({ open, onClose, onSaved }: AutomationModalProps) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateAutomationInput>({
    resolver: zodResolver(createAutomationSchema),
    defaultValues: { delayMinutes: 0, conditions: [], isActive: true },
  });

  const selectedTrigger  = watch('trigger') as AutomationTrigger | undefined;
  const selectedChannelId = watch('channelId');
  const selectedTemplateId = watch('templateId');

  const createMutation = trpc.automations.create.useMutation();

  const channelsQuery = trpc.omni.listChannels.useQuery(undefined, { enabled: open });
  const templatesQuery = trpc.templates.list.useQuery(
    { limit: 100 },
    { enabled: open },
  );

  // Filtra templates pelo canal selecionado
  const selectedChannel = channelsQuery.data?.channels.find((c) => c.id === selectedChannelId);
  const compatibleTemplates = (templatesQuery.data?.data ?? []).filter((t) => {
    if (!selectedChannel) return true;
    return !t.channel_type || t.channel_type === selectedChannel.type;
  });

  // Preview da mensagem com dados fictícios
  const selectedTemplate = compatibleTemplates.find((t) => t.id === selectedTemplateId);
  const previewText = selectedTemplate ? previewTemplate(selectedTemplate.body) : null;

  async function onSubmit(data: CreateAutomationInput) {
    try {
      await createMutation.mutateAsync(data);
      reset();
      onSaved();
      onClose();
    } catch (err) {
      // Erro exibido via estado do formulário
    }
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg" aria-labelledby="modal-title">
        <DialogHeader>
          <DialogTitle id="modal-title">Nova Automação</DialogTitle>
        </DialogHeader>

        <form id="automation-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="Ex: Lembrete WhatsApp 24h"
              aria-describedby={errors.name ? 'name-err' : undefined}
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p id="name-err" className="text-xs text-destructive" role="alert">
                {errors.name.message}
              </p>
            )}
          </div>

          {/* Trigger */}
          <div className="space-y-1.5">
            <Label htmlFor="trigger">Gatilho</Label>
            <Controller
              name="trigger"
              control={control}
              render={({ field }) => (
                <SelectRoot value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="trigger" aria-label="Selecionar gatilho" aria-invalid={!!errors.trigger}>
                    <SelectValue placeholder="Selecione o gatilho…" />
                  </SelectTrigger>
                  <SelectContent>
                    {AUTOMATION_TRIGGERS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TRIGGER_META[t].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </SelectRoot>
              )}
            />
            {errors.trigger && (
              <p className="text-xs text-destructive" role="alert">{errors.trigger.message}</p>
            )}
          </div>

          {/* Info do trigger */}
          {selectedTrigger && <TriggerInfo trigger={selectedTrigger} />}

          {/* Canal */}
          <div className="space-y-1.5">
            <Label htmlFor="channelId">Canal</Label>
            <Controller
              name="channelId"
              control={control}
              render={({ field }) => (
                <SelectRoot value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="channelId" aria-label="Selecionar canal" aria-invalid={!!errors.channelId}>
                    <SelectValue placeholder="Selecione o canal…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(channelsQuery.data?.channels ?? [])
                      .filter((c) => ['whatsapp', 'sms', 'email'].includes(c.type))
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} ({c.type})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </SelectRoot>
              )}
            />
            {errors.channelId && (
              <p className="text-xs text-destructive" role="alert">{errors.channelId.message}</p>
            )}
          </div>

          {/* Template */}
          <div className="space-y-1.5">
            <Label htmlFor="templateId">Template</Label>
            <Controller
              name="templateId"
              control={control}
              render={({ field }) => (
                <SelectRoot value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="templateId" aria-label="Selecionar template" aria-invalid={!!errors.templateId}>
                    <SelectValue placeholder={selectedChannelId ? 'Selecione o template…' : 'Selecione o canal primeiro'} />
                  </SelectTrigger>
                  <SelectContent>
                    {compatibleTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                        {t.is_default && ' ★'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </SelectRoot>
              )}
            />
            {errors.templateId && (
              <p className="text-xs text-destructive" role="alert">{errors.templateId.message}</p>
            )}
          </div>

          {/* Preview */}
          {previewText && (
            <div className="rounded-lg border border-border bg-muted/50 p-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Prévia da mensagem:</p>
              <p className="text-sm leading-relaxed">{previewText}</p>
            </div>
          )}

          {/* Delay */}
          <div className="space-y-1.5">
            <Label htmlFor="delayMinutes">Delay adicional (minutos)</Label>
            <Input
              id="delayMinutes"
              type="number"
              min={0}
              {...register('delayMinutes', { valueAsNumber: true })}
              aria-describedby={errors.delayMinutes ? 'delay-err' : 'delay-help'}
            />
            <p id="delay-help" className="text-xs text-muted-foreground">
              Minutos extras de atraso após o gatilho. Use 0 para disparo imediato.
            </p>
            {errors.delayMinutes && (
              <p id="delay-err" className="text-xs text-destructive" role="alert">
                {errors.delayMinutes.message}
              </p>
            )}
          </div>

          {/* Ativo */}
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label htmlFor="isActive" className="text-sm font-medium">Ativar automação</Label>
              <p className="text-xs text-muted-foreground">Automação começa a disparar imediatamente.</p>
            </div>
            <Controller
              name="isActive"
              control={control}
              render={({ field }) => (
                <Switch
                  id="isActive"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  aria-label="Ativar automação"
                />
              )}
            />
          </div>

          {/* Erro geral */}
          {createMutation.error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {createMutation.error.message}
            </p>
          )}
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" form="automation-form" disabled={isSubmitting || createMutation.isPending}>
            {isSubmitting || createMutation.isPending ? 'Salvando…' : 'Criar Automação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
