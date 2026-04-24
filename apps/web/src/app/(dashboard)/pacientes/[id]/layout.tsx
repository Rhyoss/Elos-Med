'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Calendar } from 'lucide-react';
import { AllergyBanner, Button, LoadingSkeleton } from '@dermaos/ui';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc-provider';

/* ── Tabs ────────────────────────────────────────────────────────────────── */

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

/* ── Skeleton ────────────────────────────────────────────────────────────── */

function PatientHeaderSkeleton() {
  return (
    <div className="flex items-center gap-4 px-6 py-4 border-b border-border bg-card">
      <LoadingSkeleton className="h-14 w-14 rounded-full shrink-0" />
      <div className="flex flex-col gap-2 flex-1">
        <LoadingSkeleton className="h-5 w-48 rounded" />
        <LoadingSkeleton className="h-4 w-32 rounded" />
      </div>
    </div>
  );
}

/* ── Header do paciente ──────────────────────────────────────────────────── */

interface PatientInfo {
  name:      string;
  age?:      number | null;
  gender?:   string | null;
  bloodType?: string | null;
  photoUrl?: string | null;
  allergies: string[];
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

  const meta = [
    patient.age  != null ? `${patient.age} anos` : null,
    patient.gender ? GENDER_LABELS[patient.gender] : null,
    patient.bloodType ? `Tipo ${patient.bloodType}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <>
      <div className="flex items-center gap-4 px-6 py-4 bg-card border-b border-border">
        {/* Avatar */}
        {patient.photoUrl ? (
          <img
            src={patient.photoUrl}
            alt=""
            aria-hidden="true"
            className="h-14 w-14 rounded-full object-cover ring-2 ring-primary-200 shrink-0"
          />
        ) : (
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700 font-semibold text-lg ring-2 ring-primary-200"
            aria-hidden="true"
          >
            {initials}
          </span>
        )}

        {/* Info */}
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <h1 className="text-lg font-semibold text-foreground truncate">{patient.name}</h1>
          {meta && <p className="text-sm text-muted-foreground">{meta}</p>}
        </div>

        {/* CTA */}
        <Button
          size="sm"
          onClick={() => router.push(`/agenda?paciente=${patientId}`)}
          className="shrink-0"
          aria-label={`Nova consulta para ${patient.name}`}
        >
          <Calendar className="h-4 w-4" aria-hidden="true" />
          Nova Consulta
        </Button>
      </div>

      {/* Banner de alergias — prioridade crítica */}
      {patient.allergies.length > 0 && (
        <AllergyBanner allergies={patient.allergies} />
      )}
    </>
  );
}

/* ── Tabs de navegação ───────────────────────────────────────────────────── */

function PatientTabs({ patientId, tabs }: { patientId: string; tabs: PatientTab[] }) {
  const pathname = usePathname();

  function isActive(segment: string) {
    return pathname.endsWith(`/${segment}`) || pathname.includes(`/${segment}/`);
  }

  return (
    <nav
      aria-label="Seções do paciente"
      className="flex overflow-x-auto border-b border-border bg-card px-6 scrollbar-none"
    >
      {tabs.map((tab) => {
        const active = isActive(tab.segment);
        return (
          <Link
            key={tab.segment}
            href={`/pacientes/${patientId}/${tab.segment}`}
            className={cn(
              'flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 pb-3 pt-3 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
            )}
            aria-current={active ? 'page' : undefined}
          >
            {tab.label}
            {tab.badge != null && tab.badge > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                {tab.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/* ── Layout principal ────────────────────────────────────────────────────── */

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
      enabled:          !!id,
      staleTime:        30_000,
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
        allergies: patient.allergies,
      }
    : {
        name:      'Carregando…',
        allergies: [],
      };

  return (
    <div className="flex flex-col h-full">
      {isLoading ? (
        <PatientHeaderSkeleton />
      ) : (
        <PatientHeader patient={patientInfo} patientId={id} />
      )}

      <PatientTabs patientId={id} tabs={TABS} />

      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
