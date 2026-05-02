'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Glass, Btn, Ico, Mono, Badge, PageHero, T, Skeleton, EmptyState,
} from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { useToast } from '@dermaos/ui';
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_STATUS_LABELS,
  CONSENT_STATUS_LABELS,
  type DocumentType,
  type DocumentStatus,
  type ConsentStatus,
} from '@dermaos/shared';
import type { DocumentPublic, ConsentTermPublic } from '@/lib/hooks/use-documents';

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_VARIANT: Record<DocumentStatus, 'success' | 'warning' | 'danger' | 'default'> = {
  rascunho: 'default',
  emitido:  'warning',
  assinado: 'success',
  revogado: 'danger',
};

const CONSENT_VARIANT: Record<ConsentStatus, 'success' | 'warning' | 'danger'> = {
  pendente: 'warning',
  assinado: 'success',
  revogado: 'danger',
};

type FilterTab = 'todos' | 'pendentes' | 'assinados' | 'termos';

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function DocumentosPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [filterTab, setFilterTab] = React.useState<FilterTab>('todos');
  const [typeFilter, setTypeFilter] = React.useState<DocumentType | ''>('');
  const [page, setPage] = React.useState(1);

  // Map filterTab to query params
  const statusFilter: DocumentStatus | undefined =
    filterTab === 'pendentes' ? 'emitido' :
    filterTab === 'assinados' ? 'assinado' :
    undefined;

  const docsQ = trpc.clinical.documents.list.useQuery(
    {
      type:     typeFilter || undefined,
      status:   filterTab === 'termos' ? undefined : statusFilter,
      page,
      pageSize: 40,
    },
    { staleTime: 30_000, enabled: filterTab !== 'termos' },
  );

  // For consent terms tab, we need a different endpoint (no patientId filter)
  // We use the docs list filtered by tipo = termo (they're in the documents table)
  const termsDocsQ = trpc.clinical.documents.list.useQuery(
    { type: 'termo_consentimento', page, pageSize: 40 },
    { staleTime: 30_000, enabled: filterTab === 'termos' },
  );

  const pendingCountQ = trpc.clinical.documents.pendingCounts.useQuery(
    {},
    { staleTime: 60_000 },
  );

  const signMut   = trpc.clinical.documents.sign.useMutation();
  const revokeMut = trpc.clinical.documents.revoke.useMutation();
  const utils     = trpc.useUtils();

  const [revokeTarget, setRevokeTarget] = React.useState<string | null>(null);
  const [revokeReason, setRevokeReason] = React.useState('');

  const activeQ = filterTab === 'termos' ? termsDocsQ : docsQ;
  const docs    = (activeQ.data?.data ?? []) as DocumentPublic[];
  const total   = activeQ.data?.total ?? 0;
  const totalPages = activeQ.data?.totalPages ?? 1;
  const isLoading  = activeQ.isLoading;

  async function handleSign(id: string) {
    try {
      await signMut.mutateAsync({ id });
      void utils.clinical.documents.list.invalidate();
      void utils.clinical.documents.pendingCounts.invalidate();
      toast.success('Documento assinado');
    } catch (e) {
      toast.error('Falha ao assinar', { description: e instanceof Error ? e.message : '' });
    }
  }

  async function handleRevoke() {
    if (!revokeTarget || revokeReason.trim().length < 3) return;
    try {
      await revokeMut.mutateAsync({ id: revokeTarget, reason: revokeReason });
      void utils.clinical.documents.list.invalidate();
      void utils.clinical.documents.pendingCounts.invalidate();
      setRevokeTarget(null);
      setRevokeReason('');
      toast.success('Documento revogado');
    } catch (e) {
      toast.error('Falha ao revogar', { description: e instanceof Error ? e.message : '' });
    }
  }

  const pendingDocs  = pendingCountQ.data?.documents ?? 0;
  const pendingTerms = pendingCountQ.data?.consentTerms ?? 0;

  const FILTER_TABS: { id: FilterTab; label: string; badge?: number }[] = [
    { id: 'todos',     label: 'Todos' },
    { id: 'pendentes', label: 'Pendentes', badge: pendingDocs },
    { id: 'assinados', label: 'Assinados' },
    { id: 'termos',    label: 'Termos de consentimento', badge: pendingTerms },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Mono size={10} spacing="1.5px" color={T.primary} style={{ display: 'block', marginBottom: 4 }}>
            DOCUMENTOS CLÍNICOS
          </Mono>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: T.textPrimary, margin: 0 }}>
            Biblioteca de documentos
          </h1>
          <p style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>
            Documentos, termos de consentimento e registros clínicos de todos os pacientes.
          </p>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <Glass style={{ padding: '16px 20px' }}>
          <Mono size={10} spacing="1.2px" color={T.textMuted}>TOTAL</Mono>
          <p style={{ fontSize: 26, fontWeight: 700, color: T.textPrimary, margin: '4px 0 0' }}>
            {pendingCountQ.isLoading ? '—' : total}
          </p>
          <p style={{ fontSize: 12, color: T.textMuted }}>documentos</p>
        </Glass>
        <Glass style={{ padding: '16px 20px' }}>
          <Mono size={10} spacing="1.2px" color={T.warning}>PENDENTES</Mono>
          <p style={{ fontSize: 26, fontWeight: 700, color: pendingDocs > 0 ? T.warning : T.textPrimary, margin: '4px 0 0' }}>
            {pendingCountQ.isLoading ? '—' : pendingDocs}
          </p>
          <p style={{ fontSize: 12, color: T.textMuted }}>aguardando assinatura</p>
        </Glass>
        <Glass style={{ padding: '16px 20px' }}>
          <Mono size={10} spacing="1.2px" color={T.accent}>TERMOS</Mono>
          <p style={{ fontSize: 26, fontWeight: 700, color: pendingTerms > 0 ? T.accent : T.textPrimary, margin: '4px 0 0' }}>
            {pendingCountQ.isLoading ? '—' : pendingTerms}
          </p>
          <p style={{ fontSize: 12, color: T.textMuted }}>consentimentos pendentes</p>
        </Glass>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setFilterTab(tab.id); setPage(1); }}
              style={{
                padding: '7px 14px',
                borderRadius: T.r.md,
                border: `1px solid ${filterTab === tab.id ? T.primaryBorder : T.divider}`,
                background: filterTab === tab.id ? T.primaryBg : 'transparent',
                color: filterTab === tab.id ? T.primary : T.textSecondary,
                fontSize: 13, fontWeight: filterTab === tab.id ? 600 : 400,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span style={{
                  background: T.accent, color: 'white',
                  borderRadius: 10, padding: '0 6px',
                  fontSize: 11, fontWeight: 700,
                }}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Type filter */}
        {filterTab !== 'termos' && (
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value as DocumentType | ''); setPage(1); }}
            style={{
              padding: '7px 12px',
              borderRadius: T.r.md,
              border: `1px solid ${T.divider}`,
              background: T.inputBg,
              color: T.textSecondary,
              fontSize: 13,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="">Todos os tipos</option>
            {DOCUMENT_TYPES.map((t) => (
              <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>
            ))}
          </select>
        )}
      </div>

      {/* Document list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {isLoading && (
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={70} delay={i * 60} />
          ))
        )}

        {!isLoading && docs.length === 0 && (
          <EmptyState
            label="DOCUMENTOS"
            icon="file"
            title="Nenhum documento encontrado"
            description="Ajuste os filtros ou acesse o prontuário de um paciente para criar documentos."
            action={
              <Btn small icon="file" onClick={() => router.push('/pacientes')}>
                Ir para pacientes
              </Btn>
            }
          />
        )}

        {!isLoading && docs.map((doc) => (
          <Glass key={doc.id} hover style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              {/* Info */}
              <div
                style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                onClick={() => router.push(`/pacientes/${doc.patientId}/prontuario?tab=documentos`)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
                    {doc.title}
                  </p>
                  <Badge variant={STATUS_VARIANT[doc.status]} dot={false}>
                    {DOCUMENT_STATUS_LABELS[doc.status]}
                  </Badge>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                  {doc.patientName && (
                    <Mono size={11} color={T.primary}>{doc.patientName}</Mono>
                  )}
                  <span style={{ color: T.textMuted, fontSize: 10 }}>·</span>
                  <Mono size={11} color={T.textMuted}>{DOCUMENT_TYPE_LABELS[doc.type]}</Mono>
                  <span style={{ color: T.textMuted, fontSize: 10 }}>·</span>
                  <Mono size={11} color={T.textMuted}>{fmtDate(doc.createdAt)}</Mono>
                  {doc.signedAt && (
                    <>
                      <span style={{ color: T.textMuted, fontSize: 10 }}>·</span>
                      <Mono size={11} color={T.success}>Assinado {fmtDate(doc.signedAt)}</Mono>
                    </>
                  )}
                  {doc.signedByName && (
                    <>
                      <span style={{ color: T.textMuted, fontSize: 10 }}>por</span>
                      <Mono size={11} color={T.textSecondary}>{doc.signedByName}</Mono>
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {doc.status !== 'assinado' && doc.status !== 'revogado' && (
                  <Btn
                    variant="glass"
                    small
                    icon="check"
                    loading={signMut.isPending && signMut.variables?.id === doc.id}
                    onClick={() => void handleSign(doc.id)}
                  >
                    Assinar
                  </Btn>
                )}
                {doc.status !== 'revogado' && (
                  <Btn
                    variant="ghost"
                    small
                    iconOnly
                    icon="alert"
                    title="Revogar"
                    onClick={() => { setRevokeTarget(doc.id); setRevokeReason(''); }}
                  />
                )}
              </div>
            </div>
          </Glass>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          <Btn variant="ghost" small disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ← Anterior
          </Btn>
          <Mono size={12} color={T.textSecondary} style={{ lineHeight: '30px' }}>
            {page} / {totalPages}
          </Mono>
          <Btn variant="ghost" small disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Próxima →
          </Btn>
        </div>
      )}

      {/* Revoke overlay */}
      {revokeTarget && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 900,
            background: 'rgba(10,16,12,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setRevokeTarget(null)}
        >
          <Glass
            onClick={(e) => e.stopPropagation()}
            style={{ width: 440, padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: T.r.md,
                background: T.dangerBg, border: `1px solid ${T.dangerBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Ico name="alert" size={17} color={T.danger} />
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary }}>Revogar documento</p>
                <p style={{ fontSize: 12, color: T.textMuted }}>Motivo obrigatório. Ação auditada.</p>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, color: T.textSecondary, display: 'block', marginBottom: 6 }}>
                Motivo da revogação *
              </label>
              <textarea
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="Descreva o motivo da revogação…"
                rows={3}
                autoFocus
                style={{
                  width: '100%',
                  padding: '9px 13px',
                  borderRadius: T.r.md,
                  background: T.inputBg,
                  border: `1px solid ${T.inputBorder}`,
                  color: T.textPrimary,
                  fontSize: 13,
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Btn variant="ghost" small onClick={() => setRevokeTarget(null)} disabled={revokeMut.isPending}>
                Cancelar
              </Btn>
              <Btn
                variant="danger"
                small
                loading={revokeMut.isPending}
                disabled={revokeReason.trim().length < 3}
                onClick={() => void handleRevoke()}
              >
                Confirmar revogação
              </Btn>
            </div>
          </Glass>
        </div>
      )}
    </div>
  );
}
