'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AllergyBanner, LoadingSkeleton } from '@dermaos/ui';
import { cn } from '@/lib/utils';

/* ── Tipos ──────────────────────────────────────────────────────────────── */

interface PatientTab {
  label: string;
  segment: string;
  badge?: number;
}

const TABS: PatientTab[] = [
  { label: 'Perfil',         segment: 'perfil' },
  { label: 'Prontuário',     segment: 'prontuario' },
  { label: 'Imagens',        segment: 'imagens' },
  { label: 'Protocolos',     segment: 'protocolos' },
  { label: 'Agendamentos',   segment: 'agendamentos' },
  { label: 'Financeiro',     segment: 'financeiro' },
  { label: 'Comunicação',    segment: 'comunicacao' },
  { label: 'Insumos',        segment: 'insumos' },
];

/* ── Skeleton de header ──────────────────────────────────────────────────── */

function PatientHeaderSkeleton() {
  return (
    <div className="flex items-center gap-4 px-6 py-4 border-b border-border bg-card">
      <LoadingSkeleton className="h-14 w-14 rounded-full" />
      <div className="flex flex-col gap-2">
        <LoadingSkeleton className="h-5 w-48 rounded" />
        <LoadingSkeleton className="h-4 w-32 rounded" />
      </div>
    </div>
  );
}

/* ── Header do paciente ──────────────────────────────────────────────────── */

interface PatientInfo {
  name:        string;
  age?:        number | null;
  gender?:     string | null;
  bloodType?:  string | null;
  photoUrl?:   string | null;
  allergies?:  string[];
}

function PatientHeader({ patient }: { patient: PatientInfo }) {
  const initials = patient.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const meta = [
    patient.age  != null ? `${patient.age} anos` : null,
    patient.gender,
    patient.bloodType ? `Tipo ${patient.bloodType}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <>
      <div className="flex items-center gap-4 px-6 py-4 bg-card border-b border-border">
        {/* Avatar */}
        {patient.photoUrl ? (
          <img
            src={patient.photoUrl}
            alt={patient.name}
            className="h-14 w-14 rounded-full object-cover ring-2 ring-primary-200"
          />
        ) : (
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-100 text-primary-700 font-semibold text-lg ring-2 ring-primary-200" aria-hidden="true">
            {initials}
          </span>
        )}

        {/* Info */}
        <div className="flex flex-col gap-0.5 min-w-0">
          <h1 className="text-lg font-semibold text-foreground truncate">{patient.name}</h1>
          {meta && <p className="text-sm text-muted-foreground">{meta}</p>}
        </div>
      </div>

      {/* Alergias */}
      {patient.allergies && patient.allergies.length > 0 && (
        <AllergyBanner allergies={patient.allergies} />
      )}
    </>
  );
}

/* ── Tabs de navegação ────────────────────────────────────────────────────── */

function PatientTabs({ patientId, tabs }: { patientId: string; tabs: PatientTab[] }) {
  const pathname = usePathname();

  function isActive(segment: string) {
    return pathname.endsWith(`/${segment}`) || pathname.includes(`/${segment}/`);
  }

  return (
    <div className="flex overflow-x-auto border-b border-border bg-card px-6 scrollbar-none">
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
    </div>
  );
}

/* ── Layout principal ─────────────────────────────────────────────────────── */

export default function PatientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);

  /* Placeholder patient data — substituído por trpc.patients.getById.useQuery({ id })
     quando o módulo de pacientes for implementado (Prompt 06+).            */
  const patient: PatientInfo = {
    name:      'Carregando paciente…',
    age:       null,
    gender:    null,
    bloodType: null,
    allergies: [],
  };

  const isLoading = false; /* trocar por query.isLoading */

  return (
    <div className="flex flex-col h-full">
      {/* Header fixo do paciente */}
      {isLoading ? (
        <PatientHeaderSkeleton />
      ) : (
        <PatientHeader patient={patient} />
      )}

      {/* Tabs */}
      <PatientTabs patientId={id} tabs={TABS} />

      {/* Conteúdo da aba ativa */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
