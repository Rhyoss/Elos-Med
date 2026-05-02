'use client';

import * as React from 'react';
import {
  Badge, Btn, Glass, Ico, Mono, EmptyState, Skeleton, T,
} from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_STATUS_LABELS,
  CONSENT_STATUS_LABELS,
  type DocumentType,
  type DocumentStatus,
  type ConsentStatus,
} from '@dermaos/shared';
import { useToast } from '@dermaos/ui';
import type { DocumentPublic, ConsentTermPublic } from '@/lib/hooks/use-documents';

/* ── Props ───────────────────────────────────────────────────────────────── */

interface TabDocumentosProps {
  patientId: string;
  onNovoDocumento?: () => void;
  onNovoTermo?: () => void;
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const TYPE_ICON: Partial<Record<DocumentType, 'file' | 'check' | 'edit' | 'alert'>> = {
  prescricao:                   'file',
  termo_consentimento:          'check',
  atestado:                     'edit',
  declaracao:                   'file',
  solicitacao:                  'file',
  orientacao_pos_procedimento:  'edit',
  laudo:                        'file',
  anexo:                        'file',
};

const STATUS_VARIANT: Record<DocumentStatus, 'success' | 'warning' | 'danger' | 'default'> = {
  rascunho: 'default',
  emitido:  'warning',
  assinado: 'success',
  revogado: 'danger',
};

const CONSENT_STATUS_VARIANT: Record<ConsentStatus, 'success' | 'warning' | 'danger'> = {
  pendente: 'warning',
  assinado: 'success',
  revogado: 'danger',
};

/* ── Skeleton row ────────────────────────────────────────────────────────── */

function DocSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} height={66} delay={i * 70} />
      ))}
    </div>
  );
}

/* ── Document row ────────────────────────────────────────────────────────── */

function DocumentRow({
  doc,
  onSign,
  onRevoke,
  signing,
}: {
  doc: DocumentPublic;
  onSign: (id: string) => void;
  onRevoke: (id: string) => void;
  signing: boolean;
}) {
  const icon = TYPE_ICON[doc.type] ?? 'file';
  const statusVariant = STATUS_VARIANT[doc.status];

  return (
    <Glass hover style={{ padding: '13px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        {/* Icon + info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: T.r.md, flexShrink: 0,
            background: doc.status === 'assinado' ? T.successBg : T.primaryBg,
            border: `1px solid ${doc.status === 'assinado' ? T.successBorder : T.primaryBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Ico name={icon} size={17} color={doc.status === 'assinado' ? T.success : T.primary} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{
              fontSize: 14, fontWeight: 600, color: T.textPrimary,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {doc.title}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
              <Mono size={10}>{fmtDate(doc.createdAt)}</Mono>
              <span style={{ color: T.textMuted, fontSize: 10 }}>·</span>
              <Mono size={10} color={T.textMuted}>
                {DOCUMENT_TYPE_LABELS[doc.type] ?? doc.type}
              </Mono>
              {doc.signedAt && (
                <>
                  <span style={{ color: T.textMuted, fontSize: 10 }}>·</span>
                  <Mono size={10} color={T.textMuted}>
                    Assinado {fmtDate(doc.signedAt)}
                  </Mono>
                </>
              )}
              {doc.encounterId && (
                <>
                  <span style={{ color: T.textMuted, fontSize: 10 }}>·</span>
                  <Mono size={10} color={T.textMuted}>Consulta vinculada</Mono>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Actions + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <Badge variant={statusVariant} dot={false}>
            {DOCUMENT_STATUS_LABELS[doc.status]}
          </Badge>
          {doc.status !== 'assinado' && doc.status !== 'revogado' && (
            <Btn
              variant="glass"
              small
              icon="check"
              loading={signing}
              onClick={() => onSign(doc.id)}
              style={{ fontSize: 12 }}
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
              title="Revogar documento"
              onClick={() => onRevoke(doc.id)}
              style={{ opacity: 0.55 }}
            />
          )}
        </div>
      </div>
    </Glass>
  );
}

/* ── Consent row ─────────────────────────────────────────────────────────── */

function ConsentRow({
  term,
  onSign,
  onRevoke,
  signing,
}: {
  term: ConsentTermPublic;
  onSign: (id: string) => void;
  onRevoke: (id: string) => void;
  signing: boolean;
}) {
  const statusVariant = CONSENT_STATUS_VARIANT[term.status];

  return (
    <Glass hover style={{ padding: '13px 18px', borderLeft: `3px solid ${T.accentBorder}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: T.r.md, flexShrink: 0,
            background: term.status === 'assinado' ? T.successBg : T.accentBg,
            border: `1px solid ${term.status === 'assinado' ? T.successBorder : T.accentBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Ico name="check" size={17} color={term.status === 'assinado' ? T.success : T.accent} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
              Termo de consentimento
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
              <Mono size={10}>{fmtDate(term.createdAt)}</Mono>
              {term.procedureId && (
                <>
                  <span style={{ color: T.textMuted, fontSize: 10 }}>·</span>
                  <Mono size={10} color={T.textMuted}>Procedimento vinculado</Mono>
                </>
              )}
              {term.lesionPhotoId && (
                <>
                  <span style={{ color: T.textMuted, fontSize: 10 }}>·</span>
                  <Mono size={10} color={T.textMuted}>Foto vinculada</Mono>
                </>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <Badge variant={statusVariant} dot={false}>
            {CONSENT_STATUS_LABELS[term.status]}
          </Badge>
          {term.status === 'pendente' && (
            <Btn
              variant="accent"
              small
              icon="check"
              loading={signing}
              onClick={() => onSign(term.id)}
              style={{ fontSize: 12 }}
            >
              Paciente assinou
            </Btn>
          )}
          {term.status !== 'revogado' && (
            <Btn
              variant="ghost"
              small
              iconOnly
              icon="alert"
              title="Revogar termo"
              onClick={() => onRevoke(term.id)}
              style={{ opacity: 0.55 }}
            />
          )}
        </div>
      </div>
    </Glass>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */

export function TabDocumentos({ patientId, onNovoDocumento, onNovoTermo }: TabDocumentosProps) {
  const { toast } = useToast();

  const docsQ = trpc.clinical.documents.listByPatient.useQuery(
    { patientId, pageSize: 50 },
    { staleTime: 30_000 },
  );
  const termsQ = trpc.clinical.documents.listConsentTermsByPatient.useQuery(
    { patientId, pageSize: 30 },
    { staleTime: 30_000 },
  );

  const utils = trpc.useUtils();
  const signMut  = trpc.clinical.documents.sign.useMutation();
  const signTermMut = trpc.clinical.documents.signConsentTerm.useMutation();

  const [revokeTarget, setRevokeTarget] = React.useState<{ type: 'doc' | 'term'; id: string } | null>(null);

  async function handleSignDoc(id: string) {
    try {
      await signMut.mutateAsync({ id });
      void utils.clinical.documents.listByPatient.invalidate({ patientId });
      toast.success('Documento assinado');
    } catch (e) {
      toast.error('Falha ao assinar', { description: e instanceof Error ? e.message : 'Tente novamente.' });
    }
  }

  async function handleSignTerm(id: string) {
    try {
      await signTermMut.mutateAsync({ id });
      void utils.clinical.documents.listConsentTermsByPatient.invalidate({ patientId });
      toast.success('Termo de consentimento assinado pelo paciente');
    } catch (e) {
      toast.error('Falha ao registrar assinatura', { description: e instanceof Error ? e.message : 'Tente novamente.' });
    }
  }

  function handleRevokeDoc(id: string) {
    setRevokeTarget({ type: 'doc', id });
  }

  function handleRevokeTerm(id: string) {
    setRevokeTarget({ type: 'term', id });
  }

  const isLoading = docsQ.isLoading || termsQ.isLoading;

  if (isLoading) return <DocSkeleton />;

  const docs  = (docsQ.data?.data  ?? []) as DocumentPublic[];
  const terms = (termsQ.data?.data ?? []) as ConsentTermPublic[];
  const total = docs.length + terms.length;

  // Pending badges
  const pendingDocs  = docs.filter((d) => d.status !== 'assinado' && d.status !== 'revogado').length;
  const pendingTerms = terms.filter((t) => t.status === 'pendente').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Mono size={11} spacing="1.2px" color={T.primary}>
            {total} {total === 1 ? 'DOCUMENTO' : 'DOCUMENTOS'}
          </Mono>
          {(pendingDocs + pendingTerms) > 0 && (
            <Badge variant="warning" dot>
              {pendingDocs + pendingTerms} pendente{pendingDocs + pendingTerms > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {onNovoTermo && (
            <Btn variant="ghost" small icon="check" onClick={onNovoTermo}>Novo termo</Btn>
          )}
          {onNovoDocumento && (
            <Btn variant="glass" small icon="file" onClick={onNovoDocumento}>Novo documento</Btn>
          )}
        </div>
      </div>

      {/* Empty state */}
      {total === 0 && (
        <EmptyState
          label="DOCUMENTOS"
          icon="file"
          title="Nenhum documento"
          description="Termos de consentimento, receitas, atestados e declarações aparecerão aqui quando gerados."
          action={
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              {onNovoDocumento && (
                <Btn small icon="file" onClick={onNovoDocumento}>Novo documento</Btn>
              )}
              {onNovoTermo && (
                <Btn small variant="ghost" icon="check" onClick={onNovoTermo}>Novo termo</Btn>
              )}
            </div>
          }
        />
      )}

      {/* Consent terms section */}
      {terms.length > 0 && (
        <section>
          <Mono
            size={10}
            spacing="1.5px"
            color={T.accent}
            style={{ marginBottom: 8, display: 'block' }}
          >
            TERMOS DE CONSENTIMENTO
          </Mono>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {terms.map((term) => (
              <ConsentRow
                key={term.id}
                term={term}
                onSign={handleSignTerm}
                onRevoke={handleRevokeTerm}
                signing={signTermMut.isPending && signTermMut.variables?.id === term.id}
              />
            ))}
          </div>
        </section>
      )}

      {/* Documents section */}
      {docs.length > 0 && (
        <section>
          {terms.length > 0 && (
            <Mono
              size={10}
              spacing="1.5px"
              color={T.primary}
              style={{ marginBottom: 8, display: 'block' }}
            >
              DOCUMENTOS CLÍNICOS
            </Mono>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {docs.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                onSign={handleSignDoc}
                onRevoke={handleRevokeDoc}
                signing={signMut.isPending && signMut.variables?.id === doc.id}
              />
            ))}
          </div>
        </section>
      )}

      {/* Revoke dialog */}
      {revokeTarget && (
        <RevokeDialog
          target={revokeTarget}
          patientId={patientId}
          onClose={() => setRevokeTarget(null)}
          onSuccess={() => {
            void utils.clinical.documents.listByPatient.invalidate({ patientId });
            void utils.clinical.documents.listConsentTermsByPatient.invalidate({ patientId });
            setRevokeTarget(null);
          }}
        />
      )}
    </div>
  );
}

/* ── Revoke dialog ───────────────────────────────────────────────────────── */

function RevokeDialog({
  target,
  patientId,
  onClose,
  onSuccess,
}: {
  target: { type: 'doc' | 'term'; id: string };
  patientId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = React.useState('');
  const { toast } = useToast();
  const revokeDocMut  = trpc.clinical.documents.revoke.useMutation();
  const revokeTermMut = trpc.clinical.documents.revokeConsentTerm.useMutation();

  const isPending = revokeDocMut.isPending || revokeTermMut.isPending;

  async function handleConfirm() {
    if (reason.trim().length < 3) return;
    try {
      if (target.type === 'doc') {
        await revokeDocMut.mutateAsync({ id: target.id, reason });
      } else {
        await revokeTermMut.mutateAsync({ id: target.id, reason });
      }
      toast.success('Revogação registrada');
      onSuccess();
    } catch (e) {
      toast.error('Falha ao revogar', { description: e instanceof Error ? e.message : 'Tente novamente.' });
    }
  }

  return (
    /* Simple overlay — not using Dialog primitive to avoid extra deps */
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 900,
        background: 'rgba(10,16,12,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
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
            <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary }}>
              Revogar {target.type === 'doc' ? 'documento' : 'termo de consentimento'}
            </p>
            <p style={{ fontSize: 12, color: T.textMuted }}>Motivo obrigatório. Ação auditada.</p>
          </div>
        </div>

        <div>
          <label style={{ fontSize: 12, color: T.textSecondary, display: 'block', marginBottom: 6 }}>
            Motivo da revogação *
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
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
          <Btn variant="ghost" small onClick={onClose} disabled={isPending}>Cancelar</Btn>
          <Btn
            variant="danger"
            small
            loading={isPending}
            disabled={reason.trim().length < 3}
            onClick={() => void handleConfirm()}
          >
            Confirmar revogação
          </Btn>
        </div>
      </Glass>
    </div>
  );
}
