'use client';

/**
 * PatientGuard
 *
 * Guarda de rota clínica para /pacientes/[id]/*.
 *
 * Responsabilidades:
 *  1. Valida que o patientId tem formato UUID antes de chamar a API.
 *  2. Mostra skeleton enquanto carrega.
 *  3. Mostra NotFound clínico com CTA "Voltar para pacientes" se paciente não existir.
 *  4. Redireciona para /unauthorized se o usuário não tiver permissão.
 *  5. Mostra erro genérico com retry para falhas de rede.
 *  6. NUNCA renderiza children com patientId inválido.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Btn, Glass, Ico, Mono, Skeleton, T } from '@dermaos/ui/ds';
import { usePatient } from '@/lib/hooks/use-patient';

/* ── UUID regex (todos os formatos — gen_random_uuid() é v4) ────────────── */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PatientGuardProps {
  patientId: string;
  children:  React.ReactNode;
}

export function PatientGuard({ patientId, children }: PatientGuardProps) {
  const router = useRouter();

  /* Valida formato UUID antes de qualquer chamada à API */
  const isValidUuid = UUID_REGEX.test(patientId);

  const { isLoading, patient, isNotFound, isForbidden, isNetworkError, refetch } =
    usePatient(isValidUuid ? patientId : '');

  /* ── UUID malformado — nunca chega ao backend ───────────────────── */
  if (!isValidUuid) {
    return (
      <NotFoundState
        title="ID de paciente inválido"
        description="O link que você seguiu não corresponde a um paciente válido."
        onBack={() => router.push('/pacientes')}
      />
    );
  }

  /* ── Carregando ─────────────────────────────────────────────────── */
  if (isLoading) {
    return <PatientSkeleton />;
  }

  /* ── Sem permissão ──────────────────────────────────────────────── */
  if (isForbidden) {
    router.replace('/unauthorized');
    return <PatientSkeleton />;
  }

  /* ── Paciente não existe ────────────────────────────────────────── */
  if (isNotFound || !patient) {
    return (
      <NotFoundState
        title="Paciente não encontrado"
        description="Esse prontuário não existe ou foi removido desta clínica."
        onBack={() => router.push('/pacientes')}
      />
    );
  }

  /* ── Erro de rede — exibe retry ─────────────────────────────────── */
  if (isNetworkError) {
    return (
      <NetworkErrorState onRetry={() => void refetch()} />
    );
  }

  /* ── Tudo OK — renderiza filhos ─────────────────────────────────── */
  return <>{children}</>;
}

/* ── Sub-componentes ────────────────────────────────────────────────────── */

function PatientSkeleton() {
  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header skeleton */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Skeleton width={48} height={48} style={{ borderRadius: '50%' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Skeleton width={200} height={18} />
          <Skeleton width={120} height={12} />
        </div>
      </div>
      {/* Tabs skeleton */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[80, 100, 90, 110, 80, 90].map((w, i) => (
          <Skeleton key={i} width={w} height={32} delay={i * 60} />
        ))}
      </div>
      {/* Content skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} height={120} delay={i * 80} />
        ))}
      </div>
    </div>
  );
}

interface NotFoundStateProps {
  title:       string;
  description: string;
  onBack:      () => void;
}

function NotFoundState({ title, description, onBack }: NotFoundStateProps) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 24px',
      }}
    >
      <Glass
        style={{
          padding: '40px 48px',
          textAlign: 'center',
          maxWidth: 440,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: T.r.xl,
            background: T.clinical.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ico name="user" size={26} color={T.clinical.color} />
        </div>
        <div>
          <p style={{ fontSize: 18, fontWeight: 700, color: T.textPrimary, marginBottom: 6 }}>
            {title}
          </p>
          <p style={{ fontSize: 14, color: T.textSecondary, lineHeight: 1.5 }}>
            {description}
          </p>
        </div>
        <Btn icon="arrowLeft" onClick={onBack} style={{ marginTop: 4 }}>
          Voltar para pacientes
        </Btn>
      </Glass>
    </div>
  );
}

function NetworkErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 24px',
      }}
    >
      <Glass
        style={{
          padding: '40px 48px',
          textAlign: 'center',
          maxWidth: 400,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <Ico name="alert" size={28} color={T.danger} />
        <div>
          <p style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary, marginBottom: 6 }}>
            Falha ao carregar prontuário
          </p>
          <p style={{ fontSize: 13, color: T.textSecondary }}>
            Verifique a conexão e tente novamente.
          </p>
        </div>
        <Btn variant="glass" icon="activity" onClick={onRetry}>
          Tentar novamente
        </Btn>
      </Glass>
    </div>
  );
}
