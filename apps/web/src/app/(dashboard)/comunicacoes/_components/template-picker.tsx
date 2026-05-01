'use client';

import * as React from 'react';
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverContent,
} from '@dermaos/ui';
import { Btn, Input, Mono, Ico, T } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';

type TemplateChannel = 'whatsapp' | 'sms' | 'email';
type ConvChannel    = 'whatsapp' | 'instagram' | 'email' | 'sms' | 'webchat' | 'phone';

export interface PickedTemplate {
  id:      string;
  name:    string;
  channel: TemplateChannel;
  body:    string;
  subject: string | null;
}

export interface TemplatePickerProps {
  /** Canal da conversa atual — usado para pré-filtrar templates compatíveis. */
  conversationChannel?: ConvChannel | null;
  onPick: (tpl: PickedTemplate) => void;
  trigger: React.ReactNode;
  disabled?: boolean;
}

/**
 * Categorias inferidas a partir do nome do template (backend não tem coluna).
 * Mantém a UX prometida sem mudança de schema. TODO backend: adicionar `category`
 * em `omni.templates` e expor no listTemplates para classificação confiável.
 */
function inferCategory(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('confirma'))                                return 'Confirmação';
  if (n.includes('lembrete') || n.includes('reminder'))      return 'Lembrete';
  if (n.includes('pré') || n.includes('pre-') || n.includes('pre '))
                                                              return 'Pré-procedimento';
  if (n.includes('pós') || n.includes('pos-') || n.includes('pos ') ||
      n.includes('feedback'))                                 return 'Pós-procedimento';
  if (n.includes('retorno'))                                  return 'Retorno';
  if (n.includes('exame') || n.includes('result') || n.includes('biópsia') ||
      n.includes('biopsia'))                                  return 'Resultado';
  if (n.includes('cobrança') || n.includes('cobranca') ||
      n.includes('fatura') || n.includes('financeiro'))       return 'Financeiro';
  if (n.includes('aniversário') || n.includes('aniversario') ||
      n.includes('campanha'))                                 return 'Campanha';
  return 'Outros';
}

const CATEGORY_ORDER = [
  'Confirmação',
  'Lembrete',
  'Pré-procedimento',
  'Pós-procedimento',
  'Retorno',
  'Resultado',
  'Financeiro',
  'Campanha',
  'Outros',
];

/** Mapeia canal de conversa → canal de template. Conversas sem canal direto
 *  (instagram, webchat, phone) caem em WhatsApp por aproximação textual. */
function templateChannelFor(channel: ConvChannel | null | undefined): TemplateChannel | null {
  if (!channel) return null;
  if (channel === 'whatsapp' || channel === 'sms' || channel === 'email') return channel;
  return 'whatsapp';
}

export function TemplatePicker({
  conversationChannel,
  onPick,
  trigger,
  disabled,
}: TemplatePickerProps) {
  const [open, setOpen]     = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [channel, setChannel] = React.useState<TemplateChannel | 'all'>(
    templateChannelFor(conversationChannel) ?? 'all',
  );

  React.useEffect(() => {
    const c = templateChannelFor(conversationChannel);
    if (c) setChannel(c);
  }, [conversationChannel]);

  const listQuery = trpc.templates.list.useQuery(
    {
      channel: channel === 'all' ? undefined : channel,
      search:  search.trim().length >= 2 ? search.trim() : undefined,
      limit:   100,
    },
    { enabled: open, staleTime: 30_000 },
  );

  const grouped = React.useMemo(() => {
    const buckets: Record<string, PickedTemplate[]> = {};
    for (const t of listQuery.data?.data ?? []) {
      const ch = (t.channel_type ?? 'whatsapp') as TemplateChannel;
      const cat = inferCategory(t.name);
      const item: PickedTemplate = {
        id:      t.id,
        name:    t.name,
        channel: ch,
        body:    t.body,
        subject: t.subject,
      };
      (buckets[cat] ??= []).push(item);
    }
    return CATEGORY_ORDER
      .map((cat) => ({ cat, items: buckets[cat] ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [listQuery.data]);

  const isError   = listQuery.isError;
  const isLoading = listQuery.isLoading;
  const isEmpty   = !isLoading && !isError && grouped.length === 0;

  const channelOptions: Array<{ value: TemplateChannel | 'all'; label: string }> = [
    { value: 'all',      label: 'Todos' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'sms',      label: 'SMS' },
    { value: 'email',    label: 'E-mail' },
  ];

  return (
    <PopoverRoot open={open} onOpenChange={(v) => !disabled && setOpen(v)}>
      <PopoverTrigger asChild disabled={disabled}>
        {trigger}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-[360px] p-0"
        style={{ background: T.bg, border: `1px solid ${T.divider}` }}
      >
        <header
          style={{
            padding: 12,
            borderBottom: `1px solid ${T.divider}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <Mono size={8} spacing="1.1px">TEMPLATES</Mono>
          <Input
            leadingIcon="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar template…"
            autoFocus
          />
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {channelOptions.map((opt) => {
              const active = channel === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setChannel(opt.value)}
                  aria-pressed={active}
                  style={{
                    padding: '2px 10px',
                    borderRadius: T.r.pill,
                    background: active ? T.primary : T.glass,
                    color: active ? T.textInverse : T.textSecondary,
                    border: `1px solid ${active ? T.primary : T.glassBorder}`,
                    fontSize: 10,
                    fontFamily: "'IBM Plex Sans', sans-serif",
                    fontWeight: active ? 600 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </header>

        <div style={{ maxHeight: 320, overflowY: 'auto', padding: 8 }}>
          {isLoading && (
            <div style={{ padding: 16, textAlign: 'center' }}>
              <Mono size={9}>CARREGANDO TEMPLATES…</Mono>
            </div>
          )}

          {isError && (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
              <Mono size={9} color={T.danger}>FALHA AO CARREGAR</Mono>
              <Btn small variant="glass" icon="check" onClick={() => listQuery.refetch()}>
                Tentar novamente
              </Btn>
            </div>
          )}

          {isEmpty && (
            <div style={{ padding: 16, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Mono size={9}>NENHUM TEMPLATE</Mono>
              <span style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.4 }}>
                Crie templates em{' '}
                <a href="/comunicacoes/templates" style={{ color: T.primary }}>
                  Comunicações › Templates
                </a>
              </span>
            </div>
          )}

          {grouped.map((g) => (
            <section key={g.cat} style={{ marginBottom: 8 }}>
              <div style={{ padding: '4px 8px' }}>
                <Mono size={7} spacing="1px">{g.cat.toUpperCase()}</Mono>
              </div>
              <ul style={{ display: 'flex', flexDirection: 'column' }}>
                {g.items.map((tpl) => (
                  <li key={tpl.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onPick(tpl);
                        setOpen(false);
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 10px',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: T.r.sm,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        fontFamily: "'IBM Plex Sans', sans-serif",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = T.glass)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary }}>
                          {tpl.name}
                        </span>
                        <Mono size={7} spacing="0.6px">{tpl.channel.toUpperCase()}</Mono>
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          color: T.textMuted,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {tpl.body}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <footer
          style={{
            padding: '8px 12px',
            borderTop: `1px solid ${T.divider}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: T.textMuted,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Ico name="zap" size={10} color={T.textMuted} />
            Variáveis serão substituídas no envio
          </span>
          <a
            href="/comunicacoes/templates"
            style={{ fontSize: 10, color: T.primary, fontWeight: 600 }}
          >
            Gerenciar →
          </a>
        </footer>
      </PopoverContent>
    </PopoverRoot>
  );
}
