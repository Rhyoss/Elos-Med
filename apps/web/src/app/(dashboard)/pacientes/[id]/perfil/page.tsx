'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Badge,
  Bar,
  Btn,
  EmptyState,
  Glass,
  Ico,
  MetalTag,
  Mono,
  PageHero,
  Skeleton,
  Stat,
  T,
  Timeline,
  type IcoName,
  type TimelineEvent,
} from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function formatDate(d: Date | string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d as string);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', opts ?? { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const GENDER_LABELS: Record<string, string> = {
  female:            'Feminino',
  male:              'Masculino',
  non_binary:        'Não-binário',
  prefer_not_to_say: 'Prefere não informar',
  other:             'Outro',
};

const SOURCE_LABELS: Record<string, string> = {
  whatsapp:  'WhatsApp',
  google:    'Google',
  referral:  'Indicação',
  walk_in:   'Presencial',
  instagram: 'Instagram',
  facebook:  'Facebook',
  site:      'Site',
};

const EVENT_LABELS: Record<string, string> = {
  'patient.created': 'Paciente cadastrado',
  'patient.updated': 'Dados atualizados',
  'patient.merged':  'Registros mesclados',
};

function eventColor(type: string): string {
  if (type.includes('created')) return T.success;
  if (type.includes('merged'))  return T.warning;
  return T.primary;
}

function eventIcon(type: string): IcoName {
  if (type.includes('created')) return 'plus';
  if (type.includes('merged'))  return 'layers';
  return 'edit';
}

/* ── Página ──────────────────────────────────────────────────────────────── */

export default function PerfilPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id     = params.id;

  const { data: patientData, isLoading: loadingPatient, error: patientError } =
    trpc.patients.getById.useQuery({ id }, { enabled: !!id });

  const { data: activityData, isLoading: loadingActivity } =
    trpc.patients.getActivity.useQuery({ id }, { enabled: !!id });

  const patient  = patientData?.patient;
  const activity = activityData?.activity ?? [];

  if (loadingPatient) {
    return (
      <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={84} radius={16} delay={60 * i} />
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
          <Skeleton height={300} radius={16} delay={240} />
          <Skeleton height={300} radius={16} delay={300} />
        </div>
      </div>
    );
  }

  if (patientError || !patient) {
    return (
      <div style={{ padding: 32 }}>
        <Glass style={{ padding: 32 }}>
          <EmptyState
            icon="alert"
            title="Paciente não encontrado"
            description={
              patientError?.message ?? 'O perfil solicitado não existe ou foi removido.'
            }
            action={
              <Btn variant="glass" small icon="arrowLeft" onClick={() => router.push('/pacientes')}>
                Voltar para a lista
              </Btn>
            }
          />
        </Glass>
      </div>
    );
  }

  const addressParts = [
    patient.address?.street &&
      `${patient.address.street}${patient.address.number ? ', ' + patient.address.number : ''}`,
    patient.address?.complement,
    patient.address?.district,
    patient.address?.city &&
      `${patient.address.city}${patient.address.state ? ' - ' + patient.address.state : ''}`,
    patient.address?.zip,
  ].filter(Boolean);

  const timelineEvents: TimelineEvent[] = activity.map((e) => ({
    id:    e.id,
    date:  formatDate(e.occurredAt),
    label: EVENT_LABELS[e.eventType] ?? e.eventType,
    icon:  eventIcon(e.eventType),
    color: eventColor(e.eventType),
  }));

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
        eyebrow="DADOS CADASTRAIS · CLÍNICOS"
        title="Perfil do Paciente"
        actions={
          <Btn
            small
            icon="calendar"
            onClick={() => router.push(`/agenda?paciente=${id}`)}
          >
            Nova consulta
          </Btn>
        }
      />

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <Stat
          label="Total de visitas"
          value={String(patient.totalVisits ?? 0)}
          icon="activity"
          mod="clinical"
        />
        <Stat
          label="Última visita"
          value={formatDate(patient.lastVisitAt)}
          icon="calendar"
          mod="clinical"
        />
        <Stat
          label="Receita total"
          value={formatCurrency(patient.totalRevenue ?? 0)}
          icon="creditCard"
          mod="financial"
        />
        <Stat
          label="Paciente desde"
          value={formatDate(patient.firstVisitAt ?? patient.createdAt)}
          icon="user"
          mod="aiMod"
        />
      </div>

      {/* Conteúdo principal: 2 colunas */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Dados pessoais */}
          <Glass style={{ padding: '18px 22px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Ico name="user" size={15} color={T.primary} />
                <Mono size={9} spacing="1px" color={T.primary}>
                  DADOS PESSOAIS
                </Mono>
              </div>
              <Btn
                variant="ghost"
                small
                icon="edit"
                onClick={() => router.push(`/pacientes/${id}/perfil?edit=true`)}
              >
                Editar
              </Btn>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 10,
              }}
            >
              <Field icon="user" label="Nome" value={patient.name} />
              <Field
                icon="calendar"
                label="Data de nascimento"
                value={patient.birthDate ? formatDate(patient.birthDate) : null}
              />
              <Field
                icon="user"
                label="Sexo"
                value={patient.gender ? GENDER_LABELS[patient.gender] ?? patient.gender : null}
              />
              <Field icon="activity" label="Tipo sanguíneo" value={patient.bloodType} />
              <Field icon="phone" label="Telefone" value={patient.phone} />
              <Field icon="phone" label="Tel. secundário" value={patient.phoneSecondary} />
              <Field icon="mail" label="E-mail" value={patient.email} />
              {addressParts.length > 0 && (
                <Field
                  icon="globe"
                  label="Endereço"
                  value={addressParts.join(' · ')}
                  span={2}
                />
              )}
            </div>
          </Glass>

          {/* Dados clínicos */}
          {(patient.allergies.length > 0 ||
            patient.chronicConditions.length > 0 ||
            patient.activeMedications.length > 0) && (
            <Glass style={{ padding: '18px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Ico name="shield" size={15} color={T.clinical.color} />
                <Mono size={9} spacing="1px" color={T.clinical.color}>
                  DADOS CLÍNICOS
                </Mono>
              </div>

              {patient.allergies.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <Mono size={7} color={T.danger}>
                    ALERGIAS
                  </Mono>
                  <div
                    style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}
                    role="list"
                  >
                    {patient.allergies.map((a) => (
                      <Badge key={a} variant="danger" dot={false}>
                        {a}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {patient.chronicConditions.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <Mono size={7} color={T.warning}>
                    CONDIÇÕES CRÔNICAS
                  </Mono>
                  <div
                    style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}
                    role="list"
                  >
                    {patient.chronicConditions.map((c) => (
                      <Badge key={c} variant="warning" dot={false}>
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {patient.activeMedications.length > 0 && (
                <div>
                  <Mono size={7} color={T.info}>
                    MEDICAMENTOS EM USO
                  </Mono>
                  <div
                    style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}
                    role="list"
                  >
                    {patient.activeMedications.map((m) => (
                      <Badge key={m} variant="info" dot={false}>
                        {m}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </Glass>
          )}

          {/* Notas internas */}
          {patient.internalNotes && (
            <Glass style={{ padding: '18px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Ico name="file" size={15} color={T.textSecondary} />
                <Mono size={9} spacing="1px" color={T.textSecondary}>
                  OBSERVAÇÕES INTERNAS
                </Mono>
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: T.textSecondary,
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.55,
                  margin: 0,
                }}
              >
                {patient.internalNotes}
              </p>
            </Glass>
          )}
        </div>

        {/* Coluna lateral */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Origem */}
          {(patient.sourceChannel || patient.sourceCampaign) && (
            <Glass style={{ padding: '18px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Ico name="hash" size={15} color={T.aiMod.color} />
                <Mono size={9} spacing="1px" color={T.aiMod.color}>
                  ORIGEM
                </Mono>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {patient.sourceChannel && (
                  <Field
                    icon="hash"
                    label="Canal"
                    value={SOURCE_LABELS[patient.sourceChannel] ?? patient.sourceChannel}
                  />
                )}
                {patient.sourceCampaign && (
                  <Field icon="hash" label="Campanha" value={patient.sourceCampaign} />
                )}
              </div>
            </Glass>
          )}

          {/* Compliance / portal */}
          <Glass metal style={{ padding: '14px 18px' }}>
            <Mono size={9} spacing="1px" color={T.primary}>
              COMPLIANCE
            </Mono>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              <MetalTag>LGPD</MetalTag>
              <MetalTag>AES-256-GCM</MetalTag>
              <MetalTag>RLS</MetalTag>
              {patient.portalEnabled && <MetalTag>PORTAL ATIVO</MetalTag>}
            </div>
          </Glass>

          {/* Histórico de atividade */}
          <Glass style={{ padding: '18px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Ico name="clock" size={15} color={T.primary} />
              <Mono size={9} spacing="1px" color={T.primary}>
                HISTÓRICO DE ATIVIDADE
              </Mono>
            </div>
            {loadingActivity ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} height={32} radius={6} delay={60 * i} />
                ))}
              </div>
            ) : (
              <Timeline events={timelineEvents} emptyLabel="Nenhuma atividade registrada." />
            )}
          </Glass>

          {/* Atalhos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Btn
              icon="message"
              onClick={() => router.push(`/comunicacoes?paciente=${id}`)}
            >
              Enviar mensagem
            </Btn>
            <Btn
              variant="glass"
              icon="creditCard"
              onClick={() => router.push(`/pacientes/${id}/financeiro`)}
            >
              Ver financeiro
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  span = 1,
}: {
  icon: IcoName;
  label: string;
  value: string | null | undefined;
  span?: 1 | 2;
}) {
  if (!value) return null;
  return (
    <div
      style={{
        gridColumn: span === 2 ? 'span 2' : 'span 1',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '8px 10px',
        borderRadius: T.r.md,
        background: T.glass,
        border: `1px solid ${T.glassBorder}`,
      }}
    >
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: T.r.sm,
          background: T.primaryBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Ico name={icon} size={13} color={T.primary} />
      </div>
      <div style={{ minWidth: 0 }}>
        <Mono size={7} spacing="0.8px">
          {label.toUpperCase()}
        </Mono>
        <p
          style={{
            fontSize: 12,
            color: T.textPrimary,
            margin: '2px 0 0',
            wordBreak: 'break-word',
          }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
