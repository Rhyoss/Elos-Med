'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Badge, Input, Textarea, SelectRoot, SelectTrigger, SelectValue, SelectContent, SelectItem, Label } from '@dermaos/ui';
import { RotateCcw, Save, Eye } from 'lucide-react';
import {
  updateTemplateSchema,
  createTemplateSchema,
  TEMPLATE_VARIABLES,
  CHANNEL_CHAR_LIMITS,
  type UpdateTemplateInput,
  type CreateTemplateInput,
  type AutomationChannel,
} from '@dermaos/shared';
import { previewTemplate } from '@/lib/template-preview';
import type { TemplateRow } from '@/lib/types/template';

type EditorMode = 'create' | 'edit';

interface TemplateEditorProps {
  template?:   TemplateRow;
  mode:        EditorMode;
  isSaving:    boolean;
  canRestore?: boolean;
  onSave:      (data: UpdateTemplateInput | CreateTemplateInput) => void;
  onRestore?:  () => void;
}

const CHANNEL_OPTIONS: { value: AutomationChannel; label: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'sms',      label: 'SMS' },
  { value: 'email',    label: 'E-mail' },
];

export function TemplateEditor({
  template,
  mode,
  isSaving,
  canRestore,
  onSave,
  onRestore,
}: TemplateEditorProps) {
  const schema   = mode === 'create' ? createTemplateSchema : updateTemplateSchema;
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<UpdateTemplateInput | CreateTemplateInput>({
    resolver: zodResolver(schema as never),
    defaultValues: mode === 'edit' && template
      ? {
          id:        template.id,
          name:      template.name,
          body:      template.body,
          bodyHtml:  template.body_html ?? undefined,
          subject:   template.subject ?? undefined,
          metaHsmId: template.external_id ?? undefined,
        }
      : { name: '', channel: 'whatsapp', body: '' },
  });

  const body        = watch('body') ?? '';
  const channel     = (mode === 'create' ? watch('channel' as never) : template?.channel_type) as AutomationChannel ?? 'whatsapp';
  const charLimit   = CHANNEL_CHAR_LIMITS[channel] ?? Infinity;
  const charCount   = body.length;
  const overLimit   = charLimit !== Infinity && charCount > charLimit;

  // SMS: número de segmentos (160 chars por segmento)
  const smsSegments = channel === 'sms' ? Math.ceil(charCount / 160) || 1 : null;

  // Preview atualizado com debounce 300ms
  const [preview, setPreview] = React.useState('');
  React.useEffect(() => {
    const id = setTimeout(() => setPreview(previewTemplate(body)), 300);
    return () => clearTimeout(id);
  }, [body]);

  /* ── Inserir variável na posição do cursor ─────────────────────────────── */
  function insertVariable(variable: string) {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart ?? body.length;
    const end   = el.selectionEnd   ?? body.length;
    const newBody = body.slice(0, start) + variable + body.slice(end);
    setValue('body', newBody, { shouldDirty: true });

    // Reposiciona cursor após a variável inserida
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + variable.length;
      el.setSelectionRange(pos, pos);
    });
  }

  /* ── Highlight de variáveis no textarea (via CSS background trick não
   * é possível de forma nativa; usamos um overlay div espelhado).
   * Para simplicidade, apenas exibimos o texto sem highlight. ──────────── */

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
      {/* Coluna esquerda: formulário */}
      <form
        id="template-form"
        onSubmit={handleSubmit(onSave as never)}
        className="flex flex-col gap-5"
        aria-label="Formulário de template"
      >
        {/* Nome */}
        <div className="space-y-1.5">
          <Label htmlFor="tpl-name">Nome do template</Label>
          <Input
            id="tpl-name"
            {...register('name')}
            placeholder="Ex: Lembrete 24h — WhatsApp"
            aria-describedby={errors.name ? 'name-err' : undefined}
            aria-invalid={!!errors.name}
          />
          {errors.name && (
            <p id="name-err" className="text-xs text-destructive" role="alert">
              {String(errors.name.message)}
            </p>
          )}
        </div>

        {/* Canal — apenas no modo criação */}
        {mode === 'create' && (
          <div className="space-y-1.5">
            <Label htmlFor="tpl-channel">Canal</Label>
            <Controller
              name={'channel' as never}
              control={control}
              render={({ field }: { field: { value: string; onChange: (v: string) => void } }) => (
                <SelectRoot value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="tpl-channel" aria-label="Selecionar canal" aria-invalid={!!(errors as Record<string, unknown>)['channel']}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNEL_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </SelectRoot>
              )}
            />
          </div>
        )}

        {/* Assunto — apenas email */}
        {(channel === 'email' || template?.channel_type === 'email') && (
          <div className="space-y-1.5">
            <Label htmlFor="tpl-subject">Assunto do e-mail</Label>
            <Input
              id="tpl-subject"
              {...register('subject')}
              placeholder="Ex: Confirmação de Consulta — {{clinica}}"
            />
          </div>
        )}

        {/* ID HSM Meta — apenas WhatsApp */}
        {(channel === 'whatsapp' || template?.channel_type === 'whatsapp') && (
          <div className="space-y-1.5">
            <Label htmlFor="tpl-hsm">
              ID do template Meta (HSM)
              <span className="ml-1 text-xs font-normal text-muted-foreground">opcional</span>
            </Label>
            <Input
              id="tpl-hsm"
              {...register('metaHsmId')}
              placeholder="Ex: confirmation_template_v1"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              ID do template aprovado no WhatsApp Business Manager para envios em janela fria.
            </p>
          </div>
        )}

        {/* Variáveis disponíveis */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">
            Inserir variável
          </Label>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Variáveis disponíveis">
            {TEMPLATE_VARIABLES.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => insertVariable(v)}
                className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Inserir variável ${v}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex flex-1 flex-col space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="tpl-body">Conteúdo</Label>
            <span
              className={`text-xs tabular-nums ${overLimit ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}
              aria-live="polite"
              aria-label={`${charCount} caracteres${charLimit !== Infinity ? ` de ${charLimit}` : ''}${smsSegments ? `, ${smsSegments} segmento${smsSegments !== 1 ? 's' : ''} SMS` : ''}`}
            >
              {charCount}
              {charLimit !== Infinity && `/${charLimit}`}
              {smsSegments && ` · ${smsSegments} seg.`}
            </span>
          </div>
          <Textarea
            id="tpl-body"
            {...register('body')}
            ref={(el) => {
              (register('body').ref as (el: HTMLTextAreaElement | null) => void)(el);
              (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
            }}
            rows={8}
            placeholder="Digite o conteúdo da mensagem…"
            className={`resize-y font-mono text-sm leading-relaxed ${overLimit ? 'border-destructive focus-visible:ring-destructive' : ''}`}
            aria-describedby={errors.body ? 'body-err' : 'body-help'}
            aria-invalid={!!errors.body}
          />
          <p id="body-help" className="text-xs text-muted-foreground">
            Use as variáveis acima para personalizar a mensagem com dados do paciente.
          </p>
          {overLimit && (
            <p id="body-err" className="text-xs text-destructive font-medium" role="alert">
              Conteúdo excede o limite de {charLimit} caracteres para {channel.toUpperCase()}.
            </p>
          )}
          {errors.body && (
            <p className="text-xs text-destructive" role="alert">{String(errors.body.message)}</p>
          )}
        </div>

        {/* Ações */}
        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          {canRestore && onRestore && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRestore}
              aria-label="Restaurar conteúdo padrão"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Restaurar padrão
            </Button>
          )}
          <Button
            type="submit"
            form="template-form"
            disabled={isSaving || !isDirty || overLimit}
            className="ml-auto"
            aria-label="Salvar template"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {isSaving ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </form>

      {/* Coluna direita: preview */}
      <aside
        className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4"
        aria-label="Prévia da mensagem"
        aria-live="polite"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Eye className="h-4 w-4" aria-hidden="true" />
          Prévia
        </div>

        {/* Bolha estilo WhatsApp/SMS */}
        <div className="flex flex-1 items-start">
          {preview ? (
            <div
              className={`max-w-xs rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm whitespace-pre-wrap ${
                channel === 'email'
                  ? 'w-full rounded-lg bg-card border border-border'
                  : 'rounded-tl-sm bg-emerald-500 text-white'
              }`}
            >
              {channel === 'email' && (
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  {watch('subject' as never) ?? '(sem assunto)'}
                </p>
              )}
              {preview}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Comece a digitar para ver a prévia…
            </p>
          )}
        </div>

        {/* Contador de segmentos SMS */}
        {channel === 'sms' && charCount > 0 && (
          <div className="rounded-lg bg-card border border-border px-3 py-2">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{smsSegments}</span> segmento{smsSegments !== 1 ? 's' : ''} SMS
              {' · '}{charCount} caractere{charCount !== 1 ? 's' : ''}
              {overLimit && <span className="ml-1 font-semibold text-destructive">(limite excedido)</span>}
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
