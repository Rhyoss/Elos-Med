'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Btn,
  EmptyState,
  Glass,
  Ico,
  Mono,
  PageHero,
  Skeleton,
  T,
} from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';

type PageParams = Promise<{ id: string }>;

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp:  'WhatsApp',
  instagram: 'Instagram',
  email:     'E-mail',
  sms:       'SMS',
  webchat:   'Webchat',
};

const CHANNEL_ICON: Record<string, 'message' | 'mail' | 'phone' | 'globe'> = {
  whatsapp:  'message',
  instagram: 'message',
  email:     'mail',
  sms:       'phone',
  webchat:   'globe',
};

interface Conversation {
  id: string;
  channel: string;
  lastMessageAt?: Date | string | null;
  contactName?: string | null;
  unreadCount?: number;
  status?: string;
  contactId?: string;
  patientId?: string | null;
}

/**
 * Patient communication tab. Lists omni conversations linked to the patient
 * (when contact_id has been associated). Falls back to a CTA that opens the
 * unified inbox filtered by patient when no conversation exists yet.
 */
export default function PatientComunicacaoPage({ params }: { params: PageParams }) {
  const { id: patientId } = React.use(params);
  const router = useRouter();

  const convosQ = trpc.omni.listConversations.useQuery(
    { patientId, page: 1, pageSize: 50 } as Record<string, unknown>,
    { staleTime: 15_000 },
  );

  const data =
    (convosQ.data as { data?: Conversation[] } | undefined)?.data ??
    (convosQ.data as { conversations?: Conversation[] } | undefined)?.conversations ??
    [];

  return (
    <div
      style={{
        padding: '22px 26px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        height: '100%',
        overflowY: 'auto',
      }}
    >
      <PageHero
        eyebrow="COMUNICAÇÃO OMNICHANNEL"
        title="Conversas com o paciente"
        module="aiMod"
        icon="message"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn
              variant="glass"
              small
              icon="message"
              onClick={() => router.push(`/comunicacoes?paciente=${patientId}`)}
            >
              Inbox unificada
            </Btn>
            <Btn
              small
              icon="plus"
              onClick={() => router.push(`/comunicacoes?paciente=${patientId}&novo=1`)}
            >
              Nova conversa
            </Btn>
          </div>
        }
      />

      {convosQ.isLoading ? (
        <Skeleton height={240} radius={16} />
      ) : data.length === 0 ? (
        <Glass style={{ padding: 24 }}>
          <EmptyState
            icon="message"
            title="Nenhuma conversa registrada"
            description="Quando o paciente trocar mensagens via WhatsApp, e-mail ou outro canal, as conversas aparecerão aqui."
            action={
              <Btn
                variant="glass"
                small
                icon="message"
                onClick={() => router.push(`/comunicacoes?paciente=${patientId}`)}
              >
                Iniciar conversa
              </Btn>
            }
          />
        </Glass>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.map((conv) => {
            const icon = CHANNEL_ICON[conv.channel] ?? 'message';
            const channelLabel = CHANNEL_LABEL[conv.channel] ?? conv.channel;
            const last = conv.lastMessageAt
              ? new Date(conv.lastMessageAt as string)
              : null;
            return (
              <Glass key={conv.id} hover style={{ padding: '14px 18px' }}>
                <button
                  type="button"
                  onClick={() => router.push(`/comunicacoes?conversa=${conv.id}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: T.r.md,
                      background: T.aiMod.bg,
                      border: `1px solid ${T.aiMod.color}18`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Ico name={icon} size={18} color={T.aiMod.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 2,
                      }}
                    >
                      <p
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: T.textPrimary,
                          margin: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {conv.contactName ?? 'Sem identificação'}
                      </p>
                      <span
                        style={{
                          padding: '1px 6px',
                          borderRadius: 999,
                          background: T.primaryBg,
                          color: T.primary,
                          fontSize: 9,
                          fontFamily: "'IBM Plex Mono', monospace",
                          fontWeight: 600,
                        }}
                      >
                        {channelLabel}
                      </span>
                    </div>
                    <Mono size={9}>
                      {last
                        ? `Última mensagem: ${last.toLocaleString('pt-BR')}`
                        : 'Sem mensagens recentes'}
                    </Mono>
                  </div>
                  {conv.unreadCount && conv.unreadCount > 0 ? (
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 999,
                        background: T.danger,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>
                        {conv.unreadCount}
                      </span>
                    </div>
                  ) : null}
                  <Ico name="arrowRight" size={16} color={T.textMuted} />
                </button>
              </Glass>
            );
          })}
        </div>
      )}
    </div>
  );
}
