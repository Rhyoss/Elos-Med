'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Btn, Ico, Mono, Skeleton, T } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';

/* ── Tabs ────────────────────────────────────────────────────────────── */

interface PatientTab {
  label:   string;
  segment: string;
  badge?:  number;
}

const TABS: PatientTab[] = [
  { label: 'Perfil',       segment: 'perfil'        },
  { label: 'Prontuário',   segment: 'prontuario'    },
  { label: 'Prescrições',  segment: 'prescricoes'   },
  { label: 'Imagens',      segment: 'imagens'       },
  { label: 'Protocolos',   segment: 'protocolos'    },
  { label: 'Agendamentos', segment: 'agendamentos'  },
  { label: 'Financeiro',   segment: 'financeiro'    },
  { label: 'Comunicação',  segment: 'comunicacao'   },
  { label: 'Insumos',      segment: 'insumos'       },
];

/* ── Skeleton header ─────────────────────────────────────────────────── */

function PatientHeaderSkeleton() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 26px',
        borderBottom: `1px solid ${T.divider}`,
      }}
    >
      <Skeleton width={48} height={48} radius={24} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <Skeleton width={180} height={18} />
        <Skeleton width={220} height={11} delay={80} />
      </div>
      <Skeleton width={120} height={32} delay={120} radius={10} />
    </div>
  );
}

/* ── Header DS ───────────────────────────────────────────────────────── */

interface PatientInfo {
  name:       string;
  age?:       number | null;
  gender?:    string | null;
  bloodType?: string | null;
  photoUrl?:  string | null;
  phone?:     string | null;
  allergies:  string[];
}

const GENDER_LABELS: Record<string, string> = {
  female:            'Feminino',
  male:              'Masculino',
  non_binary:        'Não-binário',
  prefer_not_to_say: 'Prefere não informar',
  other:             'Outro',
};

function PatientHeader({ patient, patientId }: { patient: PatientInfo; patientId: string }) {
  const router = useRouter();

  const initials = patient.name
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const metaBits = [
    patient.age != null ? `${patient.age}a` : null,
    patient.gender ? GENDER_LABELS[patient.gender] ?? patient.gender : null,
    patient.bloodType ? `Tipo ${patient.bloodType}` : null,
  ].filter(Boolean) as string[];

  const hasAllergies = patient.allergies.length > 0;
  const allergiesSummary = hasAllergies
    ? patient.allergies.length === 1
      ? patient.allergies[0]!
      : `${patient.allergies[0]!} +${patient.allergies.length - 1}`
    : null;

  const phoneTrimmed = patient.phone?.trim();
  const hasPhone = !!phoneTrimmed;
  const telHref = phoneTrimmed ? `tel:${phoneTrimmed.replace(/\D/g, '')}` : undefined;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 26px',
        borderBottom: `1px solid ${T.divider}`,
        background: T.glass,
        backdropFilter: `blur(${T.glassBlur}px) saturate(160%)`,
        WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(160%)`,
        flexShrink: 0,
      }}
    >
      {/* Avatar (clica → volta para a lista) */}
      <Link
        href="/pacientes"
        aria-label="Voltar para lista de pacientes"
        style={{ display: 'inline-flex', textDecoration: 'none', flexShrink: 0 }}
      >
        {patient.photoUrl ? (
          <img
            src={patient.photoUrl}
            alt=""
            aria-hidden
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              objectFit: 'cover',
              border: `2px solid ${T.clinical.color}30`,
            }}
          />
        ) : (
          <span
            aria-hidden
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: T.clinical.bg,
              border: `2px solid ${T.clinical.color}30`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: T.clinical.color,
              fontWeight: 700,
              fontSize: 17,
              fontFamily: "'IBM Plex Sans', sans-serif",
              letterSpacing: '-0.02em',
            }}
          >
            {initials}
          </span>
        )}
      </Link>

      {/* Info — identidade compacta com chips inline */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Mono size={9} spacing="1.2px" color={T.clinical.color}>
          PRONTUÁRIO {patientId.slice(0, 8).toUpperCase()}
        </Mono>
        <h1
          style={{
            fontSize: 19,
            fontWeight: 700,
            color: T.textPrimary,
            letterSpacing: '-0.01em',
            lineHeight: 1.15,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            margin: 0,
          }}
        >
          {patient.name}
        </h1>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            marginTop: 2,
          }}
        >
          {metaBits.length > 0 && (
            <span style={{ fontSize: 12, color: T.textSecondary }}>
              {metaBits.join(' · ')}
            </span>
          )}
          {hasAllergies && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px 2px 6px',
                borderRadius: T.r.pill,
                background: `${T.danger}12`,
                border: `1px solid ${T.danger}33`,
                fontSize: 11,
                color: T.danger,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                maxWidth: 240,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={`Alergias: ${patient.allergies.join(', ')}`}
            >
              <Ico name="alert" size={11} color={T.danger} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {allergiesSummary}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Action toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexShrink: 0,
        }}
      >
        {hasPhone && telHref && (
          <a
            href={telHref}
            aria-label={`Ligar para ${patient.name}`}
            title={`Ligar — ${phoneTrimmed}`}
            style={{ display: 'inline-flex', textDecoration: 'none' }}
          >
            <Btn variant="glass" small icon="phone" iconOnly>
              Ligar
            </Btn>
          </a>
        )}
        <Btn
          variant="glass"
          small
          icon="message"
          iconOnly
          onClick={() => router.push(`/pacientes/${patientId}/comunicacao`)}
          aria-label="Mensagens do paciente"
          title="Mensagens"
        >
          Mensagens
        </Btn>
        <Btn
          variant="glass"
          small
          icon="file"
          onClick={() =>
            router.push(`/pacientes/${patientId}/prescricoes?new=1`)
          }
          aria-label="Nova prescrição"
          title="Nova prescrição"
        >
          Prescrição
        </Btn>
        <Btn
          small
          icon="calendar"
          onClick={() => router.push(`/agenda?paciente=${patientId}`)}
          aria-label={`Nova consulta para ${patient.name}`}
        >
          Nova Consulta
        </Btn>
      </div>
    </div>
  );
}

/* ── Tabs DS ─────────────────────────────────────────────────────────── */

function PatientTabs({ patientId, tabs }: { patientId: string; tabs: PatientTab[] }) {
  const pathname = usePathname();

  function isActive(segment: string) {
    return pathname.endsWith(`/${segment}`) || pathname.includes(`/${segment}/`);
  }

  return (
    <nav
      aria-label="Seções do paciente"
      style={{
        display: 'flex',
        overflowX: 'auto',
        borderBottom: `1px solid ${T.divider}`,
        padding: '0 26px',
        gap: 4,
      }}
    >
      {tabs.map((tab) => {
        const active = isActive(tab.segment);
        return (
          <Link
            key={tab.segment}
            href={`/pacientes/${patientId}/${tab.segment}`}
            aria-current={active ? 'page' : undefined}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 14px',
              whiteSpace: 'nowrap',
              borderBottom: active
                ? `2px solid ${T.clinical.color}`
                : '2px solid transparent',
              marginBottom: -1,
              color: active ? T.textPrimary : T.textMuted,
              transition: 'all 0.15s',
              textDecoration: 'none',
            }}
          >
            <Mono
              size={10}
              spacing="0.8px"
              color={active ? T.clinical.color : 'inherit'}
              weight={active ? 600 : 500}
            >
              {tab.label.toUpperCase()}
            </Mono>
            {tab.badge != null && tab.badge > 0 && (
              <span
                style={{
                  padding: '0 6px',
                  borderRadius: T.r.pill,
                  background: active ? T.clinical.bg : T.glass,
                  border: `1px solid ${active ? `${T.clinical.color}30` : T.glassBorder}`,
                  fontSize: 9,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontWeight: 600,
                  color: active ? T.clinical.color : T.textMuted,
                }}
              >
                {tab.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/* ── Layout principal ────────────────────────────────────────────────── */

export default function PatientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params:   Promise<{ id: string }>;
}) {
  const { id } = React.use(params);

  const { data, isLoading } = trpc.patients.getById.useQuery(
    { id },
    {
      enabled: !!id,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  );

  const patient = data?.patient;

  const patientInfo: PatientInfo = patient
    ? {
        name:      patient.name,
        age:       patient.age,
        gender:    patient.gender,
        bloodType: patient.bloodType,
        photoUrl:  null,
        phone:     patient.phone,
        allergies: patient.allergies,
      }
    : {
        name:      'Carregando…',
        allergies: [],
      };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {isLoading ? <PatientHeaderSkeleton /> : <PatientHeader patient={patientInfo} patientId={id} />}

      <PatientTabs patientId={id} tabs={TABS} />

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {children}
      </div>
    </div>
  );
}
