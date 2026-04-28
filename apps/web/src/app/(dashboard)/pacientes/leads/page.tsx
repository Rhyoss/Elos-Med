'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Btn,
  EmptyState,
  Glass,
  Ico,
  Mono,
  PageHero,
  Skeleton,
  T,
  type IcoName,
} from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';

interface PatientRow {
  id:           string;
  name:         string;
  phone:        string | null;
  status:       string;
  lastVisitAt:  Date | string | null;
  createdAt:    Date | string;
  sourceChannel?: string | null;
}

const SOURCE_LABEL: Record<string, string> = {
  whatsapp:  'WhatsApp',
  instagram: 'Instagram',
  facebook:  'Facebook',
  google:    'Google',
  referral:  'Indicação',
  walk_in:   'Presencial',
  site:      'Site',
  other:     'Outros',
};

const SOURCE_ICON: Record<string, IcoName> = {
  whatsapp:  'message',
  instagram: 'message',
  facebook:  'message',
  google:    'globe',
  referral:  'users',
  walk_in:   'home',
  site:      'globe',
  other:     'user',
};

const SOURCE_MOD: Record<string, 'aiMod' | 'clinical' | 'financial' | 'supply' | 'accentMod'> = {
  whatsapp:  'aiMod',
  instagram: 'aiMod',
  facebook:  'aiMod',
  google:    'financial',
  referral:  'clinical',
  walk_in:   'supply',
  site:      'financial',
  other:     'accentMod',
};

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  return new Intl.DateTimeFormat('pt-BR', {
    day:   '2-digit',
    month: 'short',
  }).format(date);
}

/**
 * Pipeline de Leads — pacientes recém-cadastrados que ainda não tiveram a
 * primeira visita registrada. Agrupa por canal de origem (WhatsApp, Google,
 * Indicação, etc) e mostra um funil simples + tabela detalhada.
 *
 * Não cria APIs novas: filtra no client a partir de `patients.list`. Quando
 * o backend ganhar `patients.leadsList`, basta substituir a query.
 */
export default function LeadsPage() {
  const router = useRouter();
  const [activeSource, setActiveSource] = React.useState<string | null>(null);

  const listQ = trpc.patients.list.useQuery(
    { page: 1, pageSize: 100, sortBy: 'createdAt', sortDir: 'desc', status: 'active' },
    { staleTime: 30_000 },
  );

  const allPatients =
    (listQ.data as { data?: PatientRow[] } | undefined)?.data ?? [];

  // Lead = paciente sem primeira visita registrada
  const leads = allPatients.filter((p) => !p.lastVisitAt);

  const sourceCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const lead of leads) {
      const key = lead.sourceChannel ?? 'other';
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [leads]);

  const sources = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]);
  const total = leads.length;

  const filtered =
    activeSource === null
      ? leads
      : leads.filter((p) => (p.sourceChannel ?? 'other') === activeSource);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
        padding: '22px 26px',
        gap: 16,
      }}
    >
      <PageHero
        eyebrow="PIPELINE DE PROSPECÇÃO"
        title="Leads"
        actions={
          <Btn small icon="plus" onClick={() => router.push('/pacientes/novo?lead=1')}>
            Novo lead
          </Btn>
        }
      />

      {listQ.isLoading ? (
        <>
          <Skeleton height={120} radius={16} />
          <Skeleton height={300} radius={16} delay={120} />
        </>
      ) : (
        <>
          {/* Funil por origem */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <SourceCard
              label="Todos"
              count={total}
              icon="users"
              mod="clinical"
              active={activeSource === null}
              onClick={() => setActiveSource(null)}
            />
            {sources.map(([source, count]) => (
              <SourceCard
                key={source}
                label={SOURCE_LABEL[source] ?? source}
                count={count}
                icon={SOURCE_ICON[source] ?? 'user'}
                mod={SOURCE_MOD[source] ?? 'accentMod'}
                active={activeSource === source}
                onClick={() => setActiveSource(source)}
              />
            ))}
          </div>

          {/* Tabela detalhada */}
          <Glass style={{ padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                padding: '12px 18px',
                borderBottom: `1px solid ${T.divider}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Ico name="users" size={15} color={T.aiMod.color} />
                <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>
                  {activeSource === null
                    ? 'Todos os leads'
                    : `Leads — ${SOURCE_LABEL[activeSource] ?? activeSource}`}
                </span>
                <Badge variant="default" dot={false}>
                  {filtered.length}
                </Badge>
              </div>
              <Mono size={9}>SEM PRIMEIRA VISITA REGISTRADA</Mono>
            </div>

            {filtered.length === 0 ? (
              <div style={{ padding: 32 }}>
                <EmptyState
                  icon="users"
                  title="Nenhum lead nessa categoria"
                  description={
                    activeSource === null
                      ? 'Quando novos pacientes se cadastrarem sem agendar consulta, eles aparecerão aqui.'
                      : 'Ajuste o filtro acima ou cadastre um novo lead.'
                  }
                  action={
                    <Btn
                      variant="glass"
                      small
                      icon="plus"
                      onClick={() => router.push('/pacientes/novo?lead=1')}
                    >
                      Cadastrar lead
                    </Btn>
                  }
                />
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Paciente', 'Origem', 'Cadastro', 'Telefone', 'Ações'].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '9px 16px',
                          textAlign: 'left',
                          fontSize: 8,
                          fontFamily: "'IBM Plex Mono', monospace",
                          letterSpacing: '1.1px',
                          color: T.textMuted,
                          fontWeight: 500,
                          borderBottom: `1px solid ${T.divider}`,
                          background: T.metalGrad,
                        }}
                      >
                        {h.toUpperCase()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((lead, i) => {
                    const sourceKey = lead.sourceChannel ?? 'other';
                    const m = T[SOURCE_MOD[sourceKey] ?? 'accentMod'];
                    return (
                      <tr
                        key={lead.id}
                        style={{
                          borderBottom: `1px solid ${T.divider}`,
                          background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.22)',
                        }}
                      >
                        <td style={{ padding: '11px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: T.r.sm,
                                background: m.bg,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Ico name="user" size={12} color={m.color} />
                            </div>
                            <p
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: T.textPrimary,
                                margin: 0,
                              }}
                            >
                              {lead.name}
                            </p>
                          </div>
                        </td>
                        <td style={{ padding: '11px 16px' }}>
                          <Badge variant="default" dot={false}>
                            {SOURCE_LABEL[sourceKey] ?? sourceKey}
                          </Badge>
                        </td>
                        <td style={{ padding: '11px 16px' }}>
                          <Mono size={9}>{fmtDate(lead.createdAt)}</Mono>
                        </td>
                        <td style={{ padding: '11px 16px', fontSize: 11, color: T.textSecondary }}>
                          {lead.phone ?? '—'}
                        </td>
                        <td style={{ padding: '11px 16px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <Btn
                              variant="ghost"
                              small
                              icon="message"
                              onClick={() =>
                                router.push(`/comunicacoes?paciente=${lead.id}&novo=1`)
                              }
                            >
                              Mensagem
                            </Btn>
                            <Btn
                              variant="glass"
                              small
                              icon="calendar"
                              onClick={() =>
                                router.push(`/agenda?paciente=${lead.id}&novo=1`)
                              }
                            >
                              Agendar
                            </Btn>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Glass>
        </>
      )}
    </div>
  );
}

function SourceCard({
  label,
  count,
  icon,
  mod,
  active,
  onClick,
}: {
  label: string;
  count: number;
  icon: IcoName;
  mod: 'clinical' | 'aiMod' | 'supply' | 'financial' | 'accentMod';
  active: boolean;
  onClick: () => void;
}) {
  const m = T[mod];
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: 'left',
        background: active ? m.bg : T.glass,
        border: `1px solid ${active ? m.color : T.glassBorder}`,
        backdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
        WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
        borderRadius: T.r.lg,
        padding: '12px 14px',
        cursor: 'pointer',
        transition: 'all 0.18s',
        boxShadow: T.glassShadow,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 6,
        }}
      >
        <Mono size={8} color={m.color}>
          {label.toUpperCase()}
        </Mono>
        <Ico name={icon} size={14} color={m.color} />
      </div>
      <p
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: T.textPrimary,
          letterSpacing: '-0.02em',
          margin: 0,
        }}
      >
        {count}
      </p>
    </button>
  );
}
