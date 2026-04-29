'use client';

import * as React from 'react';
import { Badge, Ico, Mono, T } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';

interface ProntuarioSidebarProps {
  patientId: string;
}

const GENDER_LABELS: Record<string, string> = {
  female:            'Feminino',
  male:              'Masculino',
  non_binary:        'Não-binário',
  prefer_not_to_say: 'Prefere não informar',
  other:             'Outro',
};

const PATIENT_STATUS_LABEL: Record<string, string> = {
  active:   'Ativo',
  inactive: 'Inativo',
  archived: 'Arquivado',
  blocked:  'Bloqueado',
};

function formatDate(d: Date | string | null): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatMonthYear(d: Date | string | null): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace(/\./g, '');
}

function formatAddress(addr: NonNullable<{ street?: string; number?: string; city?: string; state?: string }> | null): string {
  if (!addr) return 'Endereço não informado';
  const parts: string[] = [];
  if (addr.street) parts.push(addr.number ? `${addr.street}, ${addr.number}` : addr.street);
  if (addr.city || addr.state) parts.push([addr.city, addr.state].filter(Boolean).join(' — '));
  return parts.join(' · ') || 'Endereço não informado';
}

function maskCpf(cpf: string | null): string {
  if (!cpf) return 'Não informado';
  if (cpf.length !== 11) return cpf;
  return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
}

function maskPhone(phone: string | null): string {
  if (!phone) return 'Não informado';
  if (phone.length === 11) return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`;
  if (phone.length === 10) return `(${phone.slice(0, 2)}) ${phone.slice(2, 6)}-${phone.slice(6)}`;
  return phone;
}

export function ProntuarioSidebar({ patientId }: ProntuarioSidebarProps) {
  const { data, isLoading } = trpc.patients.getById.useQuery(
    { id: patientId },
    { staleTime: 30_000, refetchOnWindowFocus: false },
  );

  const p = data?.patient;

  const initials = (p?.name ?? '')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const cards: Array<[string, string]> = p
    ? [
        ['Data de nascimento', formatDate(p.birthDate)],
        ['CPF',                maskCpf(p.cpf)],
        ['Telefone',           maskPhone(p.phone)],
        ['Email',              p.email ?? 'Não informado'],
        ['Tipo sanguíneo',     p.bloodType ?? 'Não informado'],
        ['Sexo',               p.gender ? GENDER_LABELS[p.gender] ?? p.gender : 'Não informado'],
        ['Status',             p.status ? PATIENT_STATUS_LABEL[p.status] ?? p.status : '—'],
        ['Visitas',            String(p.totalVisits ?? 0)],
        ['Paciente desde',     p.firstVisitAt ? formatMonthYear(p.firstVisitAt) : formatMonthYear(p.createdAt)],
      ]
    : [];

  return (
    <aside
      style={{
        width: 256,
        borderRight: `1px solid ${T.divider}`,
        overflowY: 'auto',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{ padding: '18px 16px', borderBottom: `1px solid ${T.divider}` }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <div
            aria-hidden
            style={{
              width: 56,
              height: 56,
              borderRadius: T.r.xl,
              background: T.clinical.bg,
              border: `1px solid ${T.clinical.color}18`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: T.clinical.color,
              fontWeight: 700,
              fontSize: 18,
              fontFamily: "'IBM Plex Sans', sans-serif",
            }}
          >
            {initials || <Ico name="user" size={28} color={T.clinical.color} />}
          </div>
          <div style={{ minWidth: 0 }}>
            <p
              title={p?.name ?? undefined}
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: T.textPrimary,
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {isLoading ? 'Carregando…' : p?.name ?? '—'}
            </p>
            <Mono size={9}>
              {patientId.slice(0, 8).toUpperCase()} {p?.age != null ? `· ${p.age} anos` : ''}
            </Mono>
            {p && (
              <div style={{ marginTop: 4 }}>
                <Badge variant={p.status === 'active' ? 'success' : 'default'}>
                  {PATIENT_STATUS_LABEL[p.status] ?? p.status ?? '—'}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info cards */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        {cards.map(([k, v]) => (
          <div
            key={k}
            style={{
              padding: '7px 10px',
              borderRadius: T.r.md,
              background: T.glass,
              border: `1px solid ${T.glassBorder}`,
            }}
          >
            <Mono size={7} spacing="0.8px">
              {k.toUpperCase()}
            </Mono>
            <p
              style={{
                fontSize: 12,
                color: T.textPrimary,
                marginTop: 2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {v}
            </p>
          </div>
        ))}

        {/* Allergies */}
        {p && p.allergies.length > 0 && (
          <div
            style={{
              padding: '7px 10px',
              borderRadius: T.r.md,
              background: T.dangerBg,
              border: `1px solid ${T.dangerBorder}`,
            }}
          >
            <Mono size={7} spacing="0.8px" color={T.danger}>
              ALERGIAS
            </Mono>
            <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
              {p.allergies.map((a) => (
                <Badge key={a} variant="danger" dot={false}>
                  {a}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Chronic conditions */}
        {p && p.chronicConditions.length > 0 && (
          <div
            style={{
              padding: '7px 10px',
              borderRadius: T.r.md,
              background: T.warningBg,
              border: `1px solid ${T.warningBorder}`,
            }}
          >
            <Mono size={7} spacing="0.8px" color={T.warning}>
              CONDIÇÕES CRÔNICAS
            </Mono>
            <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
              {p.chronicConditions.map((c) => (
                <Badge key={c} variant="warning" dot={false}>
                  {c}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Address */}
        <div
          style={{
            marginTop: 'auto',
            padding: '8px 10px',
            borderRadius: T.r.md,
            background: T.primaryBg,
            border: `1px solid ${T.primaryBorder}`,
          }}
        >
          <Mono size={7} color={T.primary}>
            ENDEREÇO
          </Mono>
          <p style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>{formatAddress(p?.address ?? null)}</p>
        </div>
      </div>
    </aside>
  );
}
