'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Activity,
  AlertCircle,
  Calendar,
  DollarSign,
  Edit2,
  Heart,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Tag,
  User,
} from 'lucide-react';
import {
  Button,
  Badge,
  Card,
  CardContent,
  MetricCard,
  TimelineActivity,
  type TimelineEvent,
  LoadingSkeleton,
} from '@dermaos/ui';
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
  female:          'Feminino',
  male:            'Masculino',
  non_binary:      'Não-binário',
  prefer_not_to_say: 'Prefere não informar',
  other:           'Outro',
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

function eventColor(type: string): TimelineEvent['color'] {
  if (type.includes('created')) return 'success';
  if (type.includes('merged'))  return 'warning';
  return 'default';
}

/* ── Skeleton ────────────────────────────────────────────────────────────── */

function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[0,1,2,3].map((i) => <LoadingSkeleton key={i} className="h-24 rounded-lg" />)}
      </div>
      <LoadingSkeleton className="h-64 rounded-lg" />
      <LoadingSkeleton className="h-48 rounded-lg" />
    </div>
  );
}

/* ── Seção info ──────────────────────────────────────────────────────────── */

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-muted-foreground [&_svg]:h-4 [&_svg]:w-4 shrink-0" aria-hidden="true">{icon}</span>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm text-foreground break-words">{value}</span>
      </div>
    </div>
  );
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

  if (loadingPatient) return <ProfileSkeleton />;

  if (patientError || !patient) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
        <AlertCircle className="h-10 w-10 text-danger-500" aria-hidden="true" />
        <p className="font-semibold text-foreground">Paciente não encontrado</p>
        <p className="text-sm text-muted-foreground">
          {patientError?.message ?? 'O perfil solicitado não existe ou foi removido.'}
        </p>
        <Button variant="outline" onClick={() => router.push('/pacientes')}>
          Voltar para a lista
        </Button>
      </div>
    );
  }

  const addressParts = [
    patient.address?.street && `${patient.address.street}${patient.address.number ? ', ' + patient.address.number : ''}`,
    patient.address?.complement,
    patient.address?.district,
    patient.address?.city && `${patient.address.city}${patient.address.state ? ' - ' + patient.address.state : ''}`,
    patient.address?.zip,
  ].filter(Boolean);

  const timelineEvents: TimelineEvent[] = activity.map((e) => ({
    id:        e.id,
    title:     EVENT_LABELS[e.eventType] ?? e.eventType,
    timestamp: new Date(e.occurredAt),
    color:     eventColor(e.eventType),
  }));

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      {/* Métricas */}
      <section aria-label="Resumo do paciente">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MetricCard
            label="Total de Visitas"
            value={patient.totalVisits}
            icon={<Activity />}
          />
          <MetricCard
            label="Última Visita"
            value={formatDate(patient.lastVisitAt)}
            icon={<Calendar />}
          />
          <MetricCard
            label="Receita Total"
            value={formatCurrency(patient.totalRevenue)}
            icon={<DollarSign />}
          />
          <MetricCard
            label="Paciente desde"
            value={formatDate(patient.firstVisitAt ?? patient.createdAt)}
            icon={<User />}
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Coluna principal */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Dados Pessoais */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-foreground">Dados Pessoais</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(`/pacientes/${id}/perfil?edit=true`)}
                  aria-label="Editar dados do paciente"
                >
                  <Edit2 className="h-4 w-4" aria-hidden="true" />
                  Editar
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <InfoRow icon={<User />}     label="Nome"             value={patient.name} />
                <InfoRow icon={<Calendar />} label="Data de nascimento"
                  value={patient.birthDate ? formatDate(patient.birthDate) : null} />
                <InfoRow icon={<User />}     label="Sexo"   value={patient.gender ? GENDER_LABELS[patient.gender] : null} />
                <InfoRow icon={<Heart />}    label="Tipo sanguíneo" value={patient.bloodType} />
                <InfoRow icon={<Phone />}    label="Telefone"       value={patient.phone} />
                <InfoRow icon={<Phone />}    label="Tel. secundário" value={patient.phoneSecondary} />
                <InfoRow icon={<Mail />}     label="E-mail"         value={patient.email} />
                {addressParts.length > 0 && (
                  <InfoRow
                    icon={<MapPin />}
                    label="Endereço"
                    value={addressParts.join('\n')}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Dados Clínicos */}
          {(patient.allergies.length > 0 || patient.chronicConditions.length > 0 || patient.activeMedications.length > 0) && (
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-base font-semibold text-foreground mb-4">Dados Clínicos</h2>

                {patient.allergies.length > 0 && (
                  <div className="flex flex-col gap-1.5 mb-4">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Alergias
                    </span>
                    <div className="flex flex-wrap gap-1.5" role="list" aria-label="Alergias">
                      {patient.allergies.map((a) => (
                        <Badge key={a} variant="danger" size="sm" role="listitem">{a}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {patient.chronicConditions.length > 0 && (
                  <div className="flex flex-col gap-1.5 mb-4">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Condições Crônicas
                    </span>
                    <div className="flex flex-wrap gap-1.5" role="list" aria-label="Condições crônicas">
                      {patient.chronicConditions.map((c) => (
                        <Badge key={c} variant="warning" size="sm" role="listitem">{c}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {patient.activeMedications.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Medicamentos em uso
                    </span>
                    <div className="flex flex-wrap gap-1.5" role="list" aria-label="Medicamentos em uso">
                      {patient.activeMedications.map((m) => (
                        <Badge key={m} variant="info" size="sm" role="listitem">{m}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Notas internas */}
          {patient.internalNotes && (
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-base font-semibold text-foreground mb-2">Observações Internas</h2>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{patient.internalNotes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Coluna lateral */}
        <div className="flex flex-col gap-6">
          {/* Origem */}
          {(patient.sourceChannel || patient.sourceCampaign) && (
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-base font-semibold text-foreground mb-4">Origem</h2>
                <div className="flex flex-col gap-3">
                  {patient.sourceChannel && (
                    <InfoRow
                      icon={<Tag />}
                      label="Canal"
                      value={SOURCE_LABELS[patient.sourceChannel] ?? patient.sourceChannel}
                    />
                  )}
                  {patient.sourceCampaign && (
                    <InfoRow icon={<Tag />} label="Campanha" value={patient.sourceCampaign} />
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Histórico de Atividade */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-base font-semibold text-foreground mb-4">Histórico de Atividade</h2>
              {loadingActivity ? (
                <div className="flex flex-col gap-3">
                  {[0,1,2].map((i) => <LoadingSkeleton key={i} className="h-10 rounded" />)}
                </div>
              ) : timelineEvents.length > 0 ? (
                <TimelineActivity events={timelineEvents} initialVisible={5} />
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma atividade registrada.</p>
              )}
            </CardContent>
          </Card>

          {/* Ações rápidas */}
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => router.push(`/agenda?paciente=${id}`)}
              className="w-full"
              aria-label="Agendar nova consulta para este paciente"
            >
              <Calendar className="h-4 w-4" aria-hidden="true" />
              Nova Consulta
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
