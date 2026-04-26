'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Calendar, Cake, User as UserIcon, Droplet, FileText, MoreHorizontal } from 'lucide-react';
import {
  AllergyBanner,
  Badge,
  Button,
  LoadingSkeleton,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@dermaos/ui';
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

  const chips: Array<{ icon: React.ReactNode; label: string }> = [];
  if (patient.age != null) chips.push({ icon: <Cake className="h-3 w-3" aria-hidden="true" />, label: `${patient.age} anos` });
  if (patient.gender) chips.push({ icon: <UserIcon className="h-3 w-3" aria-hidden="true" />, label: GENDER_LABELS[patient.gender] ?? patient.gender });
  if (patient.bloodType) chips.push({ icon: <Droplet className="h-3 w-3" aria-hidden="true" />, label: `Tipo ${patient.bloodType}` });

  return (
    <>
      <div className="flex items-center gap-4 px-6 py-4 bg-card border-b border-border/70">
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
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-100 to-primary-200 text-primary-700 font-semibold text-lg ring-2 ring-primary-200 dark:from-primary-100/10 dark:to-primary-200/10"
            aria-hidden="true"
          >
            {initials}
          </span>
        )}

        {/* Info */}
        <div className="flex flex-col gap-1.5 min-w-0 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-lg font-semibold text-foreground truncate tracking-tight">{patient.name}</h1>
            {patient.allergies.length > 0 && (
              <Badge variant="danger" size="sm" dot>
                {patient.allergies.length} {patient.allergies.length === 1 ? 'alergia' : 'alergias'}
              </Badge>
            )}
          </div>
          {chips.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {chips.map((c, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {c.icon}
                  {c.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/pacientes/${patientId}/prontuario`)}
            aria-label="Abrir prontuário"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            Prontuário
          </Button>
          <Button
            size="sm"
            onClick={() => router.push(`/agenda?paciente=${patientId}`)}
            aria-label={`Nova consulta para ${patient.name}`}
          >
            <Calendar className="h-4 w-4" aria-hidden="true" />
            Nova Consulta
          </Button>
          <DropdownMenuRoot>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Mais ações">
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => router.push(`/pacientes/${patientId}/perfil`)}>
                Editar perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/pacientes/${patientId}/comunicacao`)}>
                Enviar mensagem
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push(`/pacientes/${patientId}/financeiro`)}>
                Ver financeiro
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/pacientes/${patientId}/imagens`)}>
                Galeria de imagens
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuRoot>
        </div>
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
      className="flex overflow-x-auto border-b border-border/70 bg-card px-4 scrollbar-none"
    >
      {tabs.map((tab) => {
        const active = isActive(tab.segment);
        return (
          <Link
            key={tab.segment}
            href={`/pacientes/${patientId}/${tab.segment}`}
            className={cn(
              'relative flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-3 text-sm transition-colors duration-150 -mb-px',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-t',
              active
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground font-medium',
            )}
            aria-current={active ? 'page' : undefined}
          >
            {tab.label}
            {tab.badge != null && tab.badge > 0 && (
              <span
                className={cn(
                  'inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-xs font-semibold nums-tabular',
                  active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                )}
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
