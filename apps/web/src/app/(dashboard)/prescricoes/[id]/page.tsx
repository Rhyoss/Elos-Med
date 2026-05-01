'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Btn,
  Glass,
  Ico,
  Mono,
  PageHero,
  T,
} from '@dermaos/ui/ds';
import { useToast } from '@dermaos/ui';
import {
  PRESCRIPTION_STATUS_LABELS,
  type PrescriptionItem,
  type PrescriptionStatus,
  type PrescriptionType,
  type UpdatePrescriptionInput,
  type SendPrescriptionInput,
} from '@dermaos/shared';
import { trpc } from '@/lib/trpc-provider';
import { usePatient } from '@/lib/hooks/use-patient';
import { useAuthStore } from '@/stores/auth-store';
import {
  PRESCRIPTION_STATUS_VARIANT,
  useCancelPrescription,
  useDuplicatePrescription,
  usePrescription,
  usePrescriptionDeliveries,
  useRequestPrescriptionPdf,
  useSendPrescription,
  useSignPrescription,
  useUpdatePrescription,
} from '@/lib/hooks/use-prescriptions';
import {
  PrescriptionBuilder,
  type PrescriptionDraft,
} from '../_components/prescription-builder';
import { PrescriptionPreview } from '../_components/prescription-preview';
import { PrescriptionHistoryPanel } from '../_components/prescription-history-panel';
import { AllergyConfirmDialog } from '../_components/allergy-confirm-dialog';
import { CancelPrescriptionDialog } from '../_components/cancel-prescription-dialog';
import { detectAllergyConflicts } from '../_components/check-allergies';

/* ── Helpers ─────────────────────────────────────────────────────────── */

function toDateInput(d: Date | null | undefined): string {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
}

function fromDateInput(s: string): Date | undefined {
  if (!s) return undefined;
  const d = new Date(`${s}T00:00:00`);
  return isNaN(d.getTime()) ? undefined : d;
}

function buildDraftFromPrescription(
  type: PrescriptionType,
  items: PrescriptionItem[],
  notes: string | null,
  validUntil: Date | null,
): PrescriptionDraft {
  return {
    type,
    items: items.length ? items : [],
    notes: notes ?? '',
    validUntil: toDateInput(validUntil),
  };
}

function isEditable(status: PrescriptionStatus): boolean {
  return status === 'rascunho';
}

function isSigned(status: PrescriptionStatus): boolean {
  return status === 'assinada' || status === 'enviada_digital' || status === 'impressa';
}

/* ── Page ────────────────────────────────────────────────────────────── */

export default function PrescriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);
  const router = useRouter();
  const { toast } = useToast();
  const sessionUser = useAuthStore((s) => s.user);
  const sessionClinic = useAuthStore((s) => s.clinic);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const prescriptionQ = usePrescription(id);
  const prescription  = prescriptionQ.prescription;

  const patientQ = usePatient(prescription?.patientId ?? '');
  const patient  = patientQ.patient;

  const deliveriesQ = usePrescriptionDeliveries(id);

  /* ── Mutations ───────────────────────────────────────────────────── */
  const updateMut    = useUpdatePrescription();
  const signMut      = useSignPrescription();
  const cancelMut    = useCancelPrescription();
  const duplicateMut = useDuplicatePrescription();
  const sendMut      = useSendPrescription();
  const pdfMut       = useRequestPrescriptionPdf();

  /* ── Local state ─────────────────────────────────────────────────── */
  const [draft, setDraft] = React.useState<PrescriptionDraft | null>(null);
  const [allergyDialogOpen, setAllergyDialogOpen] = React.useState(false);
  const [cancelDialogOpen, setCancelDialogOpen]   = React.useState(false);
  const [isDirty, setIsDirty] = React.useState(false);

  React.useEffect(() => {
    if (prescription) {
      setDraft(buildDraftFromPrescription(
        prescription.type,
        prescription.items,
        prescription.notes,
        prescription.validUntil,
      ));
      setIsDirty(false);
    }
  }, [prescription]);

  if (prescriptionQ.isLoading || patientQ.isLoading || meQuery.isLoading) {
    return (
      <div style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
        <Glass style={{ padding: 32 }}>
          <Mono size={11} color={T.textMuted}>CARREGANDO PRESCRIÇÃO…</Mono>
        </Glass>
      </div>
    );
  }

  if (prescriptionQ.isNotFound) {
    return (
      <div style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
        <Glass style={{ padding: 32, textAlign: 'center', maxWidth: 420 }}>
          <Ico name="alert" size={26} color={T.danger} />
          <p style={{ marginTop: 8, color: T.danger, fontWeight: 600 }}>Prescrição não encontrada</p>
          <p style={{ marginTop: 4, color: T.textSecondary, fontSize: 13 }}>
            Este link pode ter expirado, ter sido removido ou pertencer a outra clínica.
          </p>
          <div style={{ marginTop: 12 }}>
            <Link href="/prescricoes">
              <Btn variant="glass" small icon="arrowLeft">Voltar para prescrições</Btn>
            </Link>
          </div>
        </Glass>
      </div>
    );
  }

  if (!prescription || !draft || !patient) {
    return (
      <div style={{ padding: 24 }}>
        <Glass style={{ padding: 24 }}>
          <p style={{ color: T.danger }}>Não foi possível carregar a prescrição. Tente novamente.</p>
        </Glass>
      </div>
    );
  }

  const editable   = isEditable(prescription.status);
  const signed     = isSigned(prescription.status);
  const cancelled  = prescription.status === 'cancelada';
  const statusInfo = {
    label:   PRESCRIPTION_STATUS_LABELS[prescription.status] ?? prescription.status,
    variant: PRESCRIPTION_STATUS_VARIANT[prescription.status] ?? 'default',
  };

  const allergies = patient.allergies ?? [];
  const conflicts = detectAllergyConflicts(draft.items, allergies);

  /* ── Validations ─────────────────────────────────────────────────── */
  function validateBeforeSign(): string | null {
    if (draft!.items.length === 0) return 'Adicione ao menos um item.';
    for (let i = 0; i < draft!.items.length; i++) {
      const it = draft!.items[i]!;
      switch (it.type) {
        case 'topica':
          if (!it.name.trim() || !it.applicationArea.trim() || !it.frequency.trim()) {
            return `Item ${i + 1}: complete medicamento, área e posologia.`;
          }
          break;
        case 'sistemica':
          if (!it.name.trim() || !it.dosage.trim() || !it.frequency.trim() || !it.durationDays) {
            return `Item ${i + 1}: complete medicamento, dose, posologia e duração.`;
          }
          break;
        case 'manipulada':
          if (!it.formulation.trim() || !it.vehicle.trim() || !it.quantity.trim()
              || !it.applicationArea.trim() || !it.frequency.trim()
              || it.components.length === 0
              || it.components.some((c) => !c.substance.trim() || !c.concentration.trim())) {
            return `Item ${i + 1}: complete fórmula, veículo, componentes (substância e concentração), quantidade, área e posologia.`;
          }
          break;
        case 'cosmeceutica':
          if (!it.name.trim() || !it.applicationArea.trim() || !it.frequency.trim()) {
            return `Item ${i + 1}: complete produto, área e frequência.`;
          }
          break;
      }
    }
    return null;
  }

  /* ── Save & Sign ─────────────────────────────────────────────────── */
  async function persistChanges(): Promise<boolean> {
    if (!draft || !prescription) return false;
    if (!editable) return true; // nada a salvar
    try {
      const input: UpdatePrescriptionInput = {
        id: prescription.id,
        items: draft.items,
        notes: draft.notes.trim().length > 0 ? draft.notes : null,
        validUntil: fromDateInput(draft.validUntil) ?? null,
      };
      await updateMut.mutateAsync(input);
      setIsDirty(false);
      return true;
    } catch (err) {
      toast.error('Não foi possível salvar', {
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
      return false;
    }
  }

  async function handleSaveDraft() {
    const ok = await persistChanges();
    if (ok) toast.success('Rascunho salvo');
  }

  async function handleSign() {
    if (!editable) return;
    const error = validateBeforeSign();
    if (error) {
      toast.warning('Revise antes de emitir', { description: error });
      return;
    }
    if (conflicts.length > 0) {
      setAllergyDialogOpen(true);
      return;
    }
    void doSign();
  }

  async function doSign() {
    setAllergyDialogOpen(false);
    const ok = await persistChanges();
    if (!ok) return;
    try {
      await signMut.mutateAsync({ id: prescription!.id });
      toast.success('Prescrição emitida e assinada');
    } catch (err) {
      toast.error('Falha ao assinar', {
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
    }
  }

  async function handleCancel(reason: string) {
    try {
      await cancelMut.mutateAsync({ id: prescription!.id, reason });
      setCancelDialogOpen(false);
      toast.success('Prescrição cancelada');
    } catch (err) {
      toast.error('Falha ao cancelar', {
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
    }
  }

  async function handleDuplicate() {
    try {
      const res = await duplicateMut.mutateAsync({ id: prescription!.id });
      toast.success('Rascunho duplicado');
      router.push(`/prescricoes/${res.prescription.id}`);
    } catch (err) {
      toast.error('Falha ao duplicar', {
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
    }
  }

  async function handleSelectFromHistory(targetId: string) {
    if (targetId === prescription!.id) return;
    if (isDirty) {
      const yes = window.confirm('Há alterações não salvas. Deseja descartá-las?');
      if (!yes) return;
    }
    router.push(`/prescricoes/${targetId}`);
  }

  async function handleDuplicateFromHistory(sourceId: string) {
    try {
      const res = await duplicateMut.mutateAsync({ id: sourceId });
      toast.success('Rascunho duplicado');
      router.push(`/prescricoes/${res.prescription.id}`);
    } catch (err) {
      toast.error('Falha ao duplicar', {
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
    }
  }

  async function handlePdf() {
    if (!signed) {
      toast.warning('Assine antes de gerar o PDF');
      return;
    }
    try {
      const res = await pdfMut.mutateAsync({ id: prescription!.id });
      window.open(res.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error('Falha ao gerar PDF', {
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
    }
  }

  async function handlePrint() {
    if (!signed) {
      toast.warning('Assine antes de imprimir');
      return;
    }
    try {
      const res = await pdfMut.mutateAsync({ id: prescription!.id });
      window.open(res.url, '_blank', 'noopener,noreferrer');
      toast.info('PDF aberto em nova aba — use o diálogo de impressão do navegador.');
    } catch (err) {
      toast.error('Falha ao imprimir', {
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
    }
  }

  async function handleSend() {
    if (!signed) {
      toast.warning('Assine antes de enviar');
      return;
    }
    const channel = window.prompt('Canal de envio (email, sms, whatsapp, portal):', 'email');
    if (!channel) return;
    if (!['email', 'sms', 'whatsapp', 'portal'].includes(channel)) {
      toast.error('Canal inválido — use email, sms, whatsapp ou portal.');
      return;
    }
    try {
      const input: SendPrescriptionInput = {
        id: prescription!.id,
        channel: channel as SendPrescriptionInput['channel'],
      };
      await sendMut.mutateAsync(input);
      toast.success('Prescrição enviada (provedor mock)', {
        description: 'O envio real será habilitado quando o provedor digital estiver configurado.',
      });
    } catch (err) {
      toast.error('Falha ao enviar', {
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
    }
  }

  /* ── Header actions ─────────────────────────────────────────────── */
  const headerActions = (
    <>
      {editable && (
        <>
          <Btn
            variant="glass"
            small
            icon="download"
            type="button"
            disabled={updateMut.isPending}
            onClick={() => void handleSaveDraft()}
          >
            Salvar rascunho
          </Btn>
          <Btn
            variant="primary"
            small
            icon="shield"
            type="button"
            disabled={signMut.isPending || updateMut.isPending}
            onClick={() => void handleSign()}
          >
            Emitir prescrição
          </Btn>
        </>
      )}
      {signed && (
        <>
          <Btn
            variant="glass"
            small
            icon="printer"
            type="button"
            disabled={pdfMut.isPending}
            onClick={() => void handlePrint()}
          >
            Imprimir
          </Btn>
          <Btn
            variant="glass"
            small
            icon="download"
            type="button"
            disabled={pdfMut.isPending}
            onClick={() => void handlePdf()}
          >
            PDF
          </Btn>
          <Btn
            variant="accent"
            small
            icon="mail"
            type="button"
            disabled={sendMut.isPending}
            onClick={() => void handleSend()}
          >
            Enviar
          </Btn>
        </>
      )}
      <Btn
        variant="ghost"
        small
        icon="copy"
        type="button"
        disabled={duplicateMut.isPending}
        onClick={() => void handleDuplicate()}
      >
        Duplicar
      </Btn>
      {!cancelled && (
        <Btn
          variant="danger"
          small
          icon="x"
          type="button"
          disabled={cancelMut.isPending}
          onClick={() => setCancelDialogOpen(true)}
        >
          Cancelar
        </Btn>
      )}
    </>
  );

  /* ── Render ──────────────────────────────────────────────────────── */
  const me = meQuery.data;
  const clinicName    = me?.clinic.name ?? sessionClinic?.name ?? null;
  const clinicLogo    = me?.clinic.logoUrl ?? sessionClinic?.logoUrl ?? null;
  const prescriberName = me?.user.name ?? sessionUser?.name ?? 'Profissional';
  const prescriberCrm  = me?.user.crm ?? sessionUser?.crm ?? null;
  const prescriberSpec = me?.user.specialty ?? sessionUser?.specialty ?? null;

  return (
    <div style={{ padding: 24, overflow: 'auto', flex: 1 }}>
      <PageHero
        eyebrow="Clínico"
        icon="file"
        module="clinical"
        title={`Prescrição ${prescription.prescriptionNumber ?? prescription.id.slice(0, 8).toUpperCase()}`}
        description={(
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Link
              href={`/pacientes/${patient.id}/prontuario`}
              style={{ color: T.primary, textDecoration: 'none', fontWeight: 600 }}
            >
              {patient.name}
            </Link>
            <span style={{ color: T.textMuted }}>·</span>
            <span>{draft.items.length} {draft.items.length === 1 ? 'item' : 'itens'}</span>
          </span>
        )}
        actions={(
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Badge variant={statusInfo.variant} dot>{statusInfo.label}</Badge>
            {prescription.signedAt && (
              <Mono size={10}>
                Assinada {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(prescription.signedAt)}
              </Mono>
            )}
            <Link href={`/pacientes/${patient.id}/prontuario`}>
              <Btn variant="ghost" small icon="arrowLeft">Prontuário</Btn>
            </Link>
          </div>
        )}
      />

      {/* Three-column layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '320px minmax(0, 1fr) 480px',
          gap: 16,
          alignItems: 'start',
        }}
      >
        {/* LEFT — history */}
        <div style={{ position: 'sticky', top: 0, alignSelf: 'start' }}>
          <PrescriptionHistoryPanel
            patientId={patient.id}
            selectedId={prescription.id}
            onSelect={(targetId) => void handleSelectFromHistory(targetId)}
            onDuplicate={(sourceId) => void handleDuplicateFromHistory(sourceId)}
          />
        </div>

        {/* CENTER — builder */}
        <div>
          <PrescriptionBuilder
            value={draft}
            onChange={(next) => {
              setDraft(next);
              setIsDirty(true);
            }}
            allergies={allergies}
            disabled={!editable}
            lockType={!editable}
            headerActions={editable ? headerActions : undefined}
          />

          {/* Cancellation info */}
          {cancelled && prescription.cancellationReason && (
            <div
              role="alert"
              style={{
                marginTop: 14,
                padding: 14,
                borderRadius: T.r.md,
                background: T.dangerBg,
                border: `1px solid ${T.dangerBorder}`,
                color: T.danger,
                fontSize: 13,
              }}
            >
              <strong>Cancelada:</strong> {prescription.cancellationReason}
            </div>
          )}

          {/* Delivery history */}
          {(deliveriesQ.data?.entries ?? []).length > 0 && (
            <Glass style={{ padding: 14, marginTop: 14 }}>
              <Mono size={11} spacing="1px" color={T.primary}>HISTÓRICO DE ENVIO</Mono>
              <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none' }}>
                {deliveriesQ.data!.entries.map((d) => (
                  <li
                    key={d.id}
                    style={{
                      padding: '6px 0',
                      borderTop: `1px solid ${T.divider}`,
                      fontSize: 13,
                      color: T.textSecondary,
                      display: 'flex',
                      gap: 10,
                      alignItems: 'center',
                    }}
                  >
                    <Badge
                      variant={d.status === 'failed' ? 'danger' : d.status === 'pending' ? 'warning' : 'success'}
                      dot={false}
                    >
                      {d.status}
                    </Badge>
                    <span style={{ color: T.textPrimary }}>{d.channel ?? '—'}</span>
                    <span>{d.recipient ?? ''}</span>
                    <span style={{ marginLeft: 'auto', color: T.textMuted }}>
                      {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(d.performedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </Glass>
          )}

          {/* Sticky actions for non-editable states still need duplicate/cancel */}
          {!editable && (
            <Glass style={{ padding: 14, marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {headerActions}
            </Glass>
          )}
        </div>

        {/* RIGHT — preview */}
        <div style={{ position: 'sticky', top: 0, alignSelf: 'start' }}>
          <Mono size={10} spacing="1px" color={T.textMuted} style={{ marginBottom: 6, display: 'block' }}>
            PRÉ-VISUALIZAÇÃO
          </Mono>
          <PrescriptionPreview
            clinicName={clinicName}
            clinicLogoUrl={clinicLogo}
            prescriberName={prescriberName}
            prescriberCrm={prescriberCrm}
            prescriberSpecialty={prescriberSpec}
            patientName={patient.name}
            patientBirthDate={null}
            type={draft.type}
            items={draft.items}
            notes={draft.notes}
            prescriptionNumber={prescription.prescriptionNumber}
            validUntil={fromDateInput(draft.validUntil) ?? null}
            signedAt={prescription.signedAt}
            signatureHash={prescription.signatureHash}
            isDraft={editable}
            isCancelled={cancelled}
          />
          {signed && (
            <p style={{ marginTop: 10, fontSize: 12, color: T.textMuted }}>
              O PDF oficial assinado é gerado pelo backend ao clicar em <strong>PDF</strong>.
              Esta visualização é uma referência fiel, não substitui o documento gerado pelo servidor.
            </p>
          )}
          {!signed && (
            <p style={{ marginTop: 10, fontSize: 12, color: T.textMuted }}>
              Pré-visualização local — o PDF assinado fica disponível após emitir a prescrição.
            </p>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <AllergyConfirmDialog
        open={allergyDialogOpen}
        onOpenChange={setAllergyDialogOpen}
        matches={conflicts}
        isLoading={signMut.isPending || updateMut.isPending}
        onConfirm={() => void doSign()}
      />

      <CancelPrescriptionDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        isLoading={cancelMut.isPending}
        onConfirm={(reason) => void handleCancel(reason)}
      />
    </div>
  );
}

