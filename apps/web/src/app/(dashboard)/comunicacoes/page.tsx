'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge, useToast } from '@dermaos/ui';
import { Btn as DSBtn, Mono, Ico, T } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { useRealtime } from '@/hooks/use-realtime';
import { useAuth } from '@/lib/auth';
import { keepPreviousData } from '@tanstack/react-query';
import { FiltersBar, type AssignmentFilter, type ChannelTypeFilter } from './_components/filters-bar';
import { ConversationList, type ConversationListItem } from './_components/conversation-list';
import { Thread, type ThreadMessage } from './_components/thread';
import { Composer } from './_components/composer';
import { ContactPanel, type ContactContext } from './_components/contact-panel';
import { ChannelIcon } from './_components/channel-icon';
import { LinkPatientDialog } from './_components/link-patient-dialog';

export default function ComunicacoesPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const utils        = trpc.useUtils();
  const { user }     = useAuth();
  const { toast }    = useToast();

  /* Filtros persistidos na URL — permite refresh sem perder contexto */
  const assignment:  AssignmentFilter  = (searchParams.get('assignment')  as AssignmentFilter)  ?? 'all';
  const channelType: ChannelTypeFilter = (searchParams.get('channelType') as ChannelTypeFilter) ?? 'all';
  const search       = searchParams.get('q') ?? '';
  const selectedId   = searchParams.get('c') ?? null;

  const hasActiveFilters =
    assignment !== 'all' ||
    channelType !== 'all' ||
    search.trim().length >= 3;

  function updateParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') params.delete(k);
      else                         params.set(k, v);
    }
    router.replace(`/comunicacoes?${params.toString()}`);
  }

  function clearFilters() {
    updateParams({ assignment: null, channelType: null, q: null });
  }

  /* ── Listagem de conversas (cursor-based, infinite scroll) ────────────── */
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [accumulated, setAccumulated] = React.useState<ConversationListItem[]>([]);

  // Reseta acumulado quando filtros mudam
  React.useEffect(() => {
    setCursor(null);
    setAccumulated([]);
  }, [assignment, channelType, search]);

  const listQuery = trpc.omni.listConversations.useQuery(
    {
      assignment,
      channelType: channelType === 'all' ? undefined : channelType,
      search:      search.length >= 3 ? search : undefined,
      cursor:      cursor ?? undefined,
      limit:       30,
    },
    { placeholderData: keepPreviousData, staleTime: 10_000, retry: 1 },
  );

  React.useEffect(() => {
    if (!listQuery.data) return;
    const items: ConversationListItem[] = listQuery.data.data.map((c) => ({
      ...c,
      lastMessageAt: c.lastMessageAt ? new Date(c.lastMessageAt) : null,
    }));
    setAccumulated((prev) => {
      if (cursor == null) return items;
      const seen = new Set(prev.map((x) => x.id));
      return [...prev, ...items.filter((i) => !seen.has(i.id))];
    });
  }, [listQuery.data, cursor]);

  /* ── Conversa selecionada ─────────────────────────────────────────────── */
  const conversationQuery = trpc.omni.getConversation.useQuery(
    { id: selectedId ?? '' },
    { enabled: !!selectedId, retry: 1 },
  );
  const conversation = conversationQuery.data?.conversation;

  const contactQuery = trpc.omni.getContactContext.useQuery(
    { contactId: conversation?.contactId ?? '' },
    { enabled: !!conversation?.contactId },
  );

  /* ── Mensagens (cursor descendente, mas UI exibe ASC) ─────────────────── */
  const [olderCursor, setOlderCursor] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ThreadMessage[]>([]);
  const [hasMoreOlder, setHasMoreOlder] = React.useState(false);

  React.useEffect(() => {
    setOlderCursor(null);
    setMessages([]);
    setHasMoreOlder(false);
  }, [selectedId]);

  const messagesQuery = trpc.omni.listMessages.useQuery(
    { conversationId: selectedId ?? '', cursor: olderCursor ?? undefined, limit: 50 },
    { enabled: !!selectedId, retry: 1 },
  );

  React.useEffect(() => {
    if (!messagesQuery.data) return;
    const fresh: ThreadMessage[] = messagesQuery.data.data.map((m) => ({
      ...m,
      createdAt: new Date(m.createdAt),
    }));
    setHasMoreOlder(!!messagesQuery.data.nextCursor);
    setMessages((prev) => {
      if (olderCursor == null) return fresh;
      // Paginação: mensagens mais antigas são antepostas
      const seen = new Set(prev.map((x) => x.id));
      return [...fresh.filter((m) => !seen.has(m.id)), ...prev];
    });
  }, [messagesQuery.data, olderCursor]);

  /* ── Marca como lida ao abrir ─────────────────────────────────────────── */
  const markReadMutation = trpc.omni.markRead.useMutation();
  React.useEffect(() => {
    if (!selectedId) return;
    markReadMutation.mutate({ conversationId: selectedId });
    setAccumulated((prev) =>
      prev.map((c) => (c.id === selectedId ? { ...c, unreadCount: 0 } : c)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  /* ── Mutations ────────────────────────────────────────────────────────── */
  const sendMutation        = trpc.omni.sendMessage.useMutation();
  const retryMutation       = trpc.omni.retryMessage.useMutation();
  const resolveMutation     = trpc.omni.resolveConversation.useMutation();
  const assignMutation      = trpc.omni.assignConversation.useMutation();
  const typingMutation      = trpc.omni.typing.useMutation();
  const updateTagsMutation  = trpc.omni.updateContactTags.useMutation();
  const linkPatientMutation = trpc.omni.linkContactToPatient.useMutation();
  const confirmApptMutation = trpc.scheduling.confirm.useMutation();

  function describeError(err: unknown): string {
    if (err instanceof Error && err.message) return err.message;
    return 'Erro inesperado. Verifique a conexão e tente novamente.';
  }

  async function handleSend(content: string, isInternalNote: boolean) {
    if (!selectedId) return;
    try {
      await sendMutation.mutateAsync({
        conversationId: selectedId,
        contentType:    'text',
        content,
        isInternalNote,
      });
      void utils.omni.listMessages.invalidate({ conversationId: selectedId });
    } catch (err) {
      toast.error('Falha ao enviar mensagem', {
        description: describeError(err),
        action: {
          label: 'Tentar novamente',
          onClick: () => void handleSend(content, isInternalNote),
        },
      });
    }
  }

  function handleTyping() {
    if (!selectedId) return;
    typingMutation.mutate({ conversationId: selectedId });
  }

  async function handleRetry(messageId: string) {
    try {
      await retryMutation.mutateAsync({ messageId });
      if (selectedId) void utils.omni.listMessages.invalidate({ conversationId: selectedId });
      toast.success('Reenvio enfileirado');
    } catch (err) {
      toast.error('Falha ao reenviar', { description: describeError(err) });
    }
  }

  async function handleResolve() {
    if (!selectedId) return;
    if (!confirm('Resolver esta conversa?')) return;
    try {
      await resolveMutation.mutateAsync({ conversationId: selectedId });
      void utils.omni.getConversation.invalidate({ id: selectedId });
      setAccumulated((prev) => prev.filter((c) => c.id !== selectedId));
      toast.success('Conversa resolvida');
    } catch (err) {
      toast.error('Falha ao resolver', { description: describeError(err) });
    }
  }

  async function handleAssumeSelf() {
    if (!selectedId || !user?.id) return;
    try {
      await assignMutation.mutateAsync({ conversationId: selectedId, assigneeId: user.id });
      void utils.omni.getConversation.invalidate({ id: selectedId });
      toast.success('Conversa atribuída a você');
    } catch (err) {
      toast.error('Falha ao assumir', { description: describeError(err) });
    }
  }

  async function handleConfirmAppointment(appointmentId: string) {
    try {
      await confirmApptMutation.mutateAsync({ id: appointmentId, via: 'manual' });
      if (conversation?.contactId) {
        void utils.omni.getContactContext.invalidate({ contactId: conversation.contactId });
      }
      toast.success('Consulta confirmada');
    } catch (err) {
      toast.error('Falha ao confirmar consulta', { description: describeError(err) });
    }
  }

  /* ── Realtime: novas mensagens, updates, typing ───────────────────────── */
  const [typingUser, setTypingUser] = React.useState<string | null>(null);
  const typingClearRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useRealtime('new_message', (payload) => {
    const p = payload as {
      conversationId: string;
      messageId:      string;
      preview?:       string;
      sender:         'patient' | 'user' | 'ai_agent';
      timestamp:      string;
      contactName?:   string;
    };
    setAccumulated((prev) => {
      const idx = prev.findIndex((c) => c.id === p.conversationId);
      if (idx === -1) {
        void utils.omni.listConversations.invalidate();
        return prev;
      }
      const updated = {
        ...prev[idx]!,
        lastMessageAt:      new Date(p.timestamp),
        lastMessagePreview: p.preview ?? prev[idx]!.lastMessagePreview,
        unreadCount:
          p.sender !== 'user' && p.conversationId !== selectedId
            ? prev[idx]!.unreadCount + 1
            : prev[idx]!.unreadCount,
      };
      const rest = prev.filter((_, i) => i !== idx);
      return [updated, ...rest];
    });

    if (p.conversationId === selectedId) {
      void utils.omni.listMessages.invalidate({ conversationId: selectedId });
    }
  });

  useRealtime('message_updated', (payload) => {
    const p = payload as { conversationId: string; messageId: string; status: ThreadMessage['status'] };
    if (p.conversationId !== selectedId) return;
    setMessages((prev) =>
      prev.map((m) => (m.id === p.messageId ? { ...m, status: p.status } : m)),
    );
  });

  useRealtime('conversation_assigned', () => {
    void utils.omni.listConversations.invalidate();
    if (selectedId) void utils.omni.getConversation.invalidate({ id: selectedId });
  });

  useRealtime('conversation_status_changed', () => {
    void utils.omni.listConversations.invalidate();
  });

  useRealtime('typing_indicator', (payload) => {
    const p = payload as { conversationId: string; userName: string };
    if (p.conversationId !== selectedId) return;
    setTypingUser(p.userName);
    if (typingClearRef.current) clearTimeout(typingClearRef.current);
    typingClearRef.current = setTimeout(() => setTypingUser(null), 3_000);
  });

  /* ── Link-patient dialog (substitui prompt nativo) ────────────────────── */
  const [linkOpen, setLinkOpen] = React.useState(false);

  /* ── Render ───────────────────────────────────────────────────────────── */
  const contact: ContactContext | null = contactQuery.data?.context
    ? {
        ...contactQuery.data.context,
        patient: contactQuery.data.context.patient
          ? {
              ...contactQuery.data.context.patient,
              lastVisitAt: contactQuery.data.context.patient.lastVisitAt
                ? new Date(contactQuery.data.context.patient.lastVisitAt)
                : null,
              recentEncounters: contactQuery.data.context.patient.recentEncounters.map((e) => ({
                ...e,
                encounteredAt: new Date(e.encounteredAt),
              })),
              nextAppointment: contactQuery.data.context.patient.nextAppointment
                ? {
                    ...contactQuery.data.context.patient.nextAppointment,
                    scheduledAt: new Date(
                      contactQuery.data.context.patient.nextAppointment.scheduledAt,
                    ),
                  }
                : null,
            }
          : null,
      }
    : null;

  /* Channels strip */
  const CH_KEYS: Array<{ id: string; type: 'whatsapp' | 'instagram' | 'email' | 'sms'; label: string }> = [
    { id: 'WA', type: 'whatsapp',  label: 'WhatsApp'  },
    { id: 'IG', type: 'instagram', label: 'Instagram' },
    { id: 'EM', type: 'email',     label: 'Email'     },
    { id: 'SM', type: 'sms',       label: 'SMS'       },
  ];
  const channelCounts = React.useMemo(() => {
    const counts: Record<string, number> = { whatsapp: 0, instagram: 0, email: 0, sms: 0 };
    for (const c of accumulated) {
      const k = String(c.channelType).toLowerCase();
      if (k in counts && c.unreadCount > 0) counts[k] = (counts[k] ?? 0) + c.unreadCount;
    }
    return counts;
  }, [accumulated]);

  return (
    <div
      className="h-full overflow-hidden"
      style={{
        display: 'grid',
        gridTemplateColumns: '68px 320px 1fr 280px',
      }}
    >
      {/* Coluna 0: Strip de canais (DS) */}
      <aside
        aria-label="Canais"
        style={{
          borderRight: `1px solid ${T.divider}`,
          background: T.metalGrad,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '12px 8px',
          gap: 6,
          flexShrink: 0,
        }}
      >
        <Mono size={7} spacing="1px">CANAIS</Mono>
        {CH_KEYS.map((ch) => {
          const active = channelType === ch.type;
          const count = channelCounts[ch.type] ?? 0;
          return (
            <button
              key={ch.id}
              type="button"
              onClick={() => updateParams({ channelType: active ? null : ch.type })}
              aria-pressed={active}
              aria-label={`${ch.label}${count > 0 ? ` (${count} não lidas)` : ''}`}
              title={ch.label}
              style={{
                width: 42,
                height: 42,
                borderRadius: T.r.md,
                background: active ? T.primaryBg : T.glass,
                border: `1px solid ${active ? T.primaryBorder : T.glassBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                cursor: 'pointer',
                transition: 'all 0.15s',
                padding: 0,
              }}
            >
              <Mono size={9} color={active ? T.primary : T.textSecondary}>{ch.id}</Mono>
              {count > 0 && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    minWidth: 14,
                    height: 14,
                    padding: '0 4px',
                    borderRadius: 999,
                    background: T.danger,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span style={{ fontSize: 7, fontWeight: 700, color: '#fff' }}>
                    {count > 99 ? '99+' : count}
                  </span>
                </span>
              )}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => router.push('/comunicacoes/agentes')}
          aria-label="Agentes IA Aurora"
          title="Aurora — Agentes IA"
          style={{
            marginTop: 'auto',
            width: 42,
            height: 42,
            borderRadius: T.r.md,
            background: T.aiBg,
            border: `1px solid ${T.aiBorder}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <Ico name="zap" size={14} color={T.ai} />
          <Mono size={6} color={T.ai}>AURORA</Mono>
        </button>
      </aside>

      {/* Coluna 1: Lista + filtros */}
      <section
        className="flex min-h-0 flex-col border-r border-border bg-background"
        aria-label="Lista de conversas"
      >
        <FiltersBar
          assignment={assignment}
          onAssignment={(v) => updateParams({ assignment: v })}
          channelType={channelType}
          onChannelType={(v) => updateParams({ channelType: v })}
          search={search}
          onSearch={(v) => updateParams({ q: v || null })}
        />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ConversationList
            items={accumulated}
            selectedId={selectedId}
            onSelect={(id) => updateParams({ c: id })}
            onLoadMore={() => {
              const nc = listQuery.data?.nextCursor ?? null;
              if (nc && nc !== cursor) setCursor(nc);
            }}
            hasMore={!!listQuery.data?.nextCursor}
            isLoading={listQuery.isLoading}
            isFetchingMore={listQuery.isFetching}
            isError={listQuery.isError}
            errorMessage={listQuery.error?.message ?? null}
            onRetry={() => {
              setCursor(null);
              setAccumulated([]);
              void listQuery.refetch();
            }}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
          />
        </div>
      </section>

      {/* Coluna 2: Conversa aberta */}
      <section
        className="flex min-h-0 flex-col bg-background"
        aria-label="Conversa aberta"
      >
        {!selectedId ? (
          <EmptyConversationState
            hasItems={accumulated.length > 0}
            isLoading={listQuery.isLoading}
          />
        ) : conversationQuery.isError ? (
          <ConversationErrorState
            message={conversationQuery.error?.message ?? null}
            onRetry={() => void conversationQuery.refetch()}
          />
        ) : !conversation ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Carregando conversa…
          </div>
        ) : (
          <>
            <header
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '12px 18px',
                borderBottom: `1px solid ${T.divider}`,
                background: T.glass,
                backdropFilter: `blur(${T.glassBlur}px) saturate(160%)`,
                WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(160%)`,
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <ChannelIcon type={conversation.channelType} className="h-5 w-5 text-muted-foreground" />
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {conversation.contactName}
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.success }} />
                    <Mono size={8}>
                      {conversation.channelName}
                      {conversation.assignedToName && ` · ${conversation.assignedToName}`}
                    </Mono>
                  </div>
                </div>
                {conversation.status === 'resolved' && (
                  <Badge variant="success" size="sm">Resolvida</Badge>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {!conversation.assignedToName && (
                  <DSBtn
                    variant="glass"
                    small
                    icon="user"
                    onClick={handleAssumeSelf}
                    loading={assignMutation.isPending}
                  >
                    Assumir
                  </DSBtn>
                )}
                <DSBtn variant="glass" small icon="arrowRight" disabled title="Escalar (em breve)">Escalar</DSBtn>
                {conversation.status !== 'resolved' && (
                  <DSBtn
                    small
                    icon="check"
                    onClick={handleResolve}
                    loading={resolveMutation.isPending}
                  >
                    Resolver
                  </DSBtn>
                )}
              </div>
            </header>

            {messagesQuery.isError && messages.length === 0 ? (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  padding: 24,
                  textAlign: 'center',
                }}
              >
                <Mono size={9} color={T.danger}>FALHA AO CARREGAR MENSAGENS</Mono>
                {messagesQuery.error?.message && (
                  <details style={{ fontSize: 10, color: T.textMuted, maxWidth: 360 }}>
                    <summary style={{ cursor: 'pointer' }}>Detalhes técnicos</summary>
                    <pre
                      style={{
                        marginTop: 6,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontFamily: "'IBM Plex Mono', monospace",
                        textAlign: 'left',
                      }}
                    >
                      {messagesQuery.error.message}
                    </pre>
                  </details>
                )}
                <DSBtn small variant="glass" icon="arrowRight" onClick={() => void messagesQuery.refetch()}>
                  Tentar novamente
                </DSBtn>
              </div>
            ) : (
              <Thread
                messages={messages}
                onLoadOlder={() => {
                  const nc = messagesQuery.data?.nextCursor ?? null;
                  if (nc && nc !== olderCursor) setOlderCursor(nc);
                }}
                hasMoreOlder={hasMoreOlder}
                isLoadingOlder={messagesQuery.isFetching}
                onRetry={handleRetry}
                typingUser={typingUser}
              />
            )}

            <Composer
              onSend={handleSend}
              onTyping={handleTyping}
              disabled={conversation.status === 'resolved' || conversation.status === 'archived'}
              isSending={sendMutation.isPending}
              conversationChannel={conversation.channelType as 'whatsapp' | 'instagram' | 'email' | 'sms' | 'webchat' | 'phone'}
            />
          </>
        )}
      </section>

      {/* Coluna 3: Contexto */}
      <div className="min-h-0">
        {selectedId && contactQuery.isError ? (
          <aside
            style={{
              height: '100%',
              borderLeft: `1px solid ${T.divider}`,
              background: 'rgba(255,255,255,0.30)',
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              textAlign: 'center',
            }}
          >
            <Mono size={9} color={T.danger}>FALHA AO CARREGAR CONTEXTO</Mono>
            <DSBtn small variant="glass" icon="arrowRight" onClick={() => void contactQuery.refetch()}>
              Tentar novamente
            </DSBtn>
          </aside>
        ) : contact ? (
          <ContactPanel
            context={contact}
            onUpdateTags={(tags) =>
              updateTagsMutation.mutate(
                { contactId: contact.id, tags },
                {
                  onError: (err) =>
                    toast.error('Falha ao atualizar tags', { description: describeError(err) }),
                },
              )
            }
            onLinkToPatient={() => setLinkOpen(true)}
            onOpenChart={(patientId) => router.push(`/pacientes/${patientId}/prontuario`)}
            onOpenAgenda={(patientId) => router.push(`/agenda?paciente=${patientId}`)}
            onConfirmAppointment={handleConfirmAppointment}
            onSendTemplate={() =>
              toast.info('Use o botão TEMPLATE no compositor', {
                description: 'Templates são inseridos diretamente na mensagem que você está escrevendo.',
              })
            }
            isUpdatingTags={updateTagsMutation.isPending}
            isConfirming={confirmApptMutation.isPending}
          />
        ) : (
          <aside
            style={{
              height: '100%',
              borderLeft: `1px solid ${T.divider}`,
              background: 'rgba(255,255,255,0.30)',
              padding: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Mono size={9}>SELECIONE UMA CONVERSA</Mono>
          </aside>
        )}
      </div>

      {contact && (
        <LinkPatientDialog
          open={linkOpen}
          onOpenChange={setLinkOpen}
          contactName={contact.name}
          isLinking={linkPatientMutation.isPending}
          onConfirm={(patientId) => {
            linkPatientMutation.mutate(
              { contactId: contact.id, patientId },
              {
                onSuccess: () => {
                  void utils.omni.getContactContext.invalidate({ contactId: contact.id });
                  setLinkOpen(false);
                  toast.success('Contato vinculado ao paciente');
                },
                onError: (err) =>
                  toast.error('Falha ao vincular', { description: describeError(err) }),
              },
            );
          }}
        />
      )}
    </div>
  );
}

/* ── Sub-componentes locais ─────────────────────────────────────────────── */

function EmptyConversationState({
  hasItems,
  isLoading,
}: {
  hasItems: boolean;
  isLoading: boolean;
}) {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: 32,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: T.glass,
          border: `1px solid ${T.glassBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ico name="message" size={24} color={T.textMuted} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 360 }}>
        <Mono size={9} spacing="1.1px">CENTRAL DE CONVERSAS</Mono>
        <p style={{ fontSize: 13, color: T.textPrimary, fontWeight: 600 }}>
          {isLoading ? 'Carregando inbox…' : 'Selecione uma conversa para começar'}
        </p>
        <p style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.5 }}>
          {hasItems
            ? 'Escolha uma conversa na lista à esquerda para ver mensagens, contexto do paciente e ações disponíveis.'
            : 'Quando pacientes ou leads enviarem mensagens nos canais conectados, elas aparecerão aqui em tempo real.'}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <a
          href="/comunicacoes/templates"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 12px',
            borderRadius: T.r.pill,
            background: T.glass,
            border: `1px solid ${T.glassBorder}`,
            color: T.textSecondary,
            fontSize: 11,
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          <Ico name="copy" size={11} color={T.textSecondary} />
          Gerenciar templates
        </a>
        <a
          href="/comunicacoes/agentes"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 12px',
            borderRadius: T.r.pill,
            background: T.aiBg,
            border: `1px solid ${T.aiBorder}`,
            color: T.ai,
            fontSize: 11,
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          <Ico name="zap" size={11} color={T.ai} />
          Aurora
        </a>
      </div>
    </div>
  );
}

function ConversationErrorState({
  message,
  onRetry,
}: {
  message: string | null;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 32,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: T.dangerBg,
          border: `1px solid ${T.dangerBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ico name="x" size={22} color={T.danger} />
      </div>
      <Mono size={9} color={T.danger}>FALHA AO ABRIR CONVERSA</Mono>
      <p style={{ fontSize: 12, color: T.textPrimary, maxWidth: 360, lineHeight: 1.5 }}>
        Não foi possível carregar esta conversa. Verifique sua conexão e tente novamente.
      </p>
      {message && (
        <details style={{ fontSize: 10, color: T.textMuted, maxWidth: 360 }}>
          <summary style={{ cursor: 'pointer' }}>Detalhes técnicos</summary>
          <pre
            style={{
              marginTop: 6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: "'IBM Plex Mono', monospace",
              textAlign: 'left',
            }}
          >
            {message}
          </pre>
        </details>
      )}
      <DSBtn small variant="glass" icon="arrowRight" onClick={onRetry}>
        Tentar novamente
      </DSBtn>
    </div>
  );
}
