'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Badge } from '@dermaos/ui';
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
import { UserPlus, ArrowUpRight, CheckCircle2 } from 'lucide-react';

export default function ComunicacoesPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const utils        = trpc.useUtils();
  const { user }     = useAuth();

  /* Filtros persistidos na URL — permite refresh sem perder contexto */
  const assignment:  AssignmentFilter  = (searchParams.get('assignment')  as AssignmentFilter)  ?? 'all';
  const channelType: ChannelTypeFilter = (searchParams.get('channelType') as ChannelTypeFilter) ?? 'all';
  const search       = searchParams.get('q') ?? '';
  const selectedId   = searchParams.get('c') ?? null;

  function updateParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') params.delete(k);
      else                         params.set(k, v);
    }
    router.replace(`/comunicacoes?${params.toString()}`);
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
    { placeholderData: keepPreviousData, staleTime: 10_000 },
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
    { enabled: !!selectedId },
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
    { enabled: !!selectedId },
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
  const sendMutation    = trpc.omni.sendMessage.useMutation();
  const retryMutation   = trpc.omni.retryMessage.useMutation();
  const resolveMutation = trpc.omni.resolveConversation.useMutation();
  const assignMutation  = trpc.omni.assignConversation.useMutation();
  const typingMutation  = trpc.omni.typing.useMutation();
  const updateTagsMutation = trpc.omni.updateContactTags.useMutation();
  const linkPatientMutation = trpc.omni.linkContactToPatient.useMutation();

  async function handleSend(content: string, isInternalNote: boolean) {
    if (!selectedId) return;
    try {
      await sendMutation.mutateAsync({
        conversationId: selectedId,
        contentType:    'text',
        content,
        isInternalNote,
      });
      // Realtime/list refresh
      void utils.omni.listMessages.invalidate({ conversationId: selectedId });
    } catch (err) {
      // Feedback rápido — TODO: toast quando disponível
      console.error('send failed', err);
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
    } catch (err) {
      console.error('retry failed', err);
    }
  }

  async function handleResolve() {
    if (!selectedId) return;
    if (!confirm('Resolver esta conversa?')) return;
    await resolveMutation.mutateAsync({ conversationId: selectedId });
    void utils.omni.getConversation.invalidate({ id: selectedId });
    setAccumulated((prev) => prev.filter((c) => c.id !== selectedId));
  }

  async function handleAssumeSelf() {
    if (!selectedId || !user?.id) return;
    await assignMutation.mutateAsync({ conversationId: selectedId, assigneeId: user.id });
    void utils.omni.getConversation.invalidate({ id: selectedId });
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
    // Atualiza a lista
    setAccumulated((prev) => {
      const idx = prev.findIndex((c) => c.id === p.conversationId);
      if (idx === -1) {
        // Conversa nova — força refetch da primeira página
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

    // Se é a conversa aberta, refetch mensagens
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

  /* ── Channels strip (reference 68px) — counts derivados das conversas
        carregadas; click filtra `channelType`. Aurora ao fundo abre /agentes. */
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
    /* Phase-4 reskin: outer chrome no padrão DS (canais 68px + lista 320px +
       chat 1fr + contexto 280px no xl). Sub-componentes Tailwind dentro de
       cada coluna ficam para Phase 5 (FiltersBar, ConversationList, Thread,
       Composer, ContactPanel). */
    <div
      className="h-full overflow-hidden"
      style={{
        display: 'grid',
        // 4 colunas DS Quite Clear: canais 68 · lista 320 · thread 1fr · contexto 280
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
          />
        </div>
      </section>

      {/* Coluna 2: Conversa aberta */}
      <section
        className="flex min-h-0 flex-col bg-background"
        aria-label="Conversa aberta"
      >
        {!selectedId ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Selecione uma conversa para começar
          </div>
        ) : !conversation ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Carregando…
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
                  <DSBtn variant="glass" small icon="user" onClick={handleAssumeSelf}>Assumir</DSBtn>
                )}
                <DSBtn variant="glass" small icon="arrowRight" disabled title="Escalar (em breve)">Escalar</DSBtn>
                {conversation.status !== 'resolved' && (
                  <DSBtn small icon="check" onClick={handleResolve}>Resolver</DSBtn>
                )}
              </div>
            </header>

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

            <Composer
              onSend={handleSend}
              onTyping={handleTyping}
              disabled={conversation.status === 'resolved' || conversation.status === 'archived'}
              isSending={sendMutation.isPending}
            />
          </>
        )}
      </section>

      {/* Coluna 3: Contexto */}
      <div className="min-h-0">
        {contact && (
          <ContactPanel
            context={contact}
            onUpdateTags={(tags) =>
              updateTagsMutation.mutate({ contactId: contact.id, tags })
            }
            onLinkToPatient={() => {
              const patientId = prompt('ID do paciente:');
              if (!patientId) return;
              linkPatientMutation.mutate(
                { contactId: contact.id, patientId },
                {
                  onSuccess: () => {
                    void utils.omni.getContactContext.invalidate({ contactId: contact.id });
                  },
                },
              );
            }}
            isUpdatingTags={updateTagsMutation.isPending}
          />
        )}
      </div>
    </div>
  );
}
