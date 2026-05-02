'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Btn,
  Glass,
  Ico,
  Mono,
  PageHero,
  T,
} from '@dermaos/ui/ds';
import { useToast } from '@dermaos/ui';
import {
  type CreatePrescriptionInput,
  type PrescriptionItem,
  type PrescriptionType,
} from '@dermaos/shared';
import { usePatient } from '@/lib/hooks/use-patient';
import { useCreatePrescription } from '@/lib/hooks/use-prescriptions';
import {
  PrescriptionBuilder,
  emptyDraft,
  type PrescriptionDraft,
} from '../_components/prescription-builder';
import { PrescriptionPreview } from '../_components/prescription-preview';
import { PrescriptionHistoryPanel } from '../_components/prescription-history-panel';
import { AllergyConfirmDialog } from '../_components/allergy-confirm-dialog';
import { detectAllergyConflicts } from '../_components/check-allergies';
import { useAuthStore } from '@/stores/auth-store';
import { usePermission } from '@/lib/auth';
import { trpc } from '@/lib/trpc-provider';

/* ── Helpers ────────────────────────────────────────────────────────── */

function fromDateInput(s: string): Date | undefined {
  if (!s) return undefined;
  const d = new Date(`${s}T00:00:00`);
  return isNaN(d.getTime()) ? undefined : d;
}

function validateDraft(draft: PrescriptionDraft): string | null {
  if (draft.items.length === 0) return 'Adicione ao menos um item.';
  for (let i = 0; i < draft.items.length; i++) {
    const it = draft.items[i] as PrescriptionItem;
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
          return `Item ${i + 1}: complete fórmula, veículo, componentes, quantidade, área e posologia.`;
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

/* ── Page ────────────────────────────────────────────────────────────── */

export default function NovaPrescricaoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const patientId   = searchParams.get('patientId') ?? '';
  const encounterId = searchParams.get('encounterId') ?? '';
  const initialType = (searchParams.get('type') as PrescriptionType | null) ?? 'topica';

  const sessionUser   = useAuthStore((s) => s.user);
  const sessionClinic = useAuthStore((s) => s.clinic);
  const canSign       = usePermission('clinical', 'sign');
  const canWriteClinical = usePermission('clinical', 'write');

  const meQuery = trpc.auth.me.useQuery(undefined, {
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const patientQ = usePatient(patientId);
  const createMut = useCreatePrescription();

  const [draft, setDraft] = React.useState<PrescriptionDraft>(emptyDraft(initialType));
  const [allergyDialogOpen, setAllergyDialogOpen] = React.useState(false);
  const [pendingSign, setPendingSign] = React.useState(false);

  /* ── Guards ─────────────────────────────────────────────────────── */
  if (!canWriteClinical && !canSign) {
    return (
      <div style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
        <Glass style={{ padding: 32, textAlign: 'center', maxWidth: 460 }}>
          <Ico name="shield" size={26} color={T.textMuted} />
          <p style={{ marginTop: 8, fontWeight: 600, color: T.textPrimary }}>Acesso restrito</p>
          <p style={{ color: T.textSecondary, fontSize: 13, marginTop: 4 }}>
            Apenas profissionais com permissão clínica podem criar prescrições. Entre em contato com o administrador da clínica.
          </p>
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
            <Link href="/prescricoes">
              <Btn variant="ghost" small icon="arrowLeft">Voltar para prescrições</Btn>
            </Link>
          </div>
        </Glass>
      </div>
    );
  }

  if (!patientId) {
    return (
      <div style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
        <Glass style={{ padding: 32, textAlign: 'center', maxWidth: 460 }}>
          <Ico name="alert" size={26} color={T.warning} />
          <p style={{ marginTop: 8, fontWeight: 600 }}>Selecione um paciente</p>
          <p style={{ color: T.textSecondary, fontSize: 13, marginTop: 4 }}>
            Para criar uma prescrição, abra primeiro o prontuário do paciente.
          </p>
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', gap: 8 }}>
            <Link href="/pacientes">
              <Btn variant="primary" small icon="users">Ir para pacientes</Btn>
            </Link>
            <Link href="/prescricoes">
              <Btn variant="ghost" small icon="arrowLeft">Voltar</Btn>
            </Link>
          </div>
        </Glass>
      </div>
    );
  }

  if (patientQ.isLoading || meQuery.isLoading) {
    return (
      <div style={{ padding: 24, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Glass style={{ padding: 32 }}>
          <Mono size={11} color={T.textMuted}>CARREGANDO PACIENTE…</Mono>
        </Glass>
      </div>
    );
  }

  if (patientQ.isNotFound || !patientQ.patient) {
    return (
      <div style={{ padding: 24, flex: 1 }}>
        <Glass style={{ padding: 32, textAlign: 'center' }}>
          <Ico name="alert" size={26} color={T.danger} />
          <p style={{ marginTop: 8, color: T.danger, fontWeight: 600 }}>Paciente não encontrado</p>
          <Link href="/pacientes">
            <Btn variant="ghost" small icon="arrowLeft" style={{ marginTop: 12 }}>Voltar para pacientes</Btn>
          </Link>
        </Glass>
      </div>
    );
  }

  const patient = patientQ.patient;
  const allergies = patient.allergies ?? [];
  const conflicts = detectAllergyConflicts(draft.items, allergies);

  const me = meQuery.data;
  const clinicName     = me?.clinic.name ?? sessionClinic?.name ?? null;
  const clinicLogo     = me?.clinic.logoUrl ?? sessionClinic?.logoUrl ?? null;
  const prescriberName = me?.user.name ?? sessionUser?.name ?? 'Profissional';
  const prescriberCrm  = me?.user.crm ?? sessionUser?.crm ?? null;
  const prescriberSpec = me?.user.specialty ?? sessionUser?.specialty ?? null;

  /* ── Submit ─────────────────────────────────────────────────────── */
  async function submit(forceSign: boolean) {
    const error = validateDraft(draft);
    if (error) {
      toast.warning('Revise antes de continuar', { description: error });
      return;
    }
    if (forceSign && conflicts.length > 0 && !allergyDialogOpen) {
      setPendingSign(true);
      setAllergyDialogOpen(true);
      return;
    }
    setAllergyDialogOpen(false);
    setPendingSign(false);

    const payload: CreatePrescriptionInput = {
      patientId,
      encounterId: encounterId || undefined,
      type: draft.type,
      items: draft.items,
      notes: draft.notes.trim() || undefined,
      validUntil: fromDateInput(draft.validUntil),
    };

    try {
      const res = await createMut.mutateAsync(payload);
      const newId = res.prescription.id;
      if (forceSign) {
        // Após criar como rascunho, redireciona ao detalhe e o usuário clica em emitir
        // (signing usa o mesmo fluxo na detalhe; mantemos único caminho de assinatura).
        toast.info('Rascunho criado — emita para assinar', {
          description: 'Revise e clique em "Emitir prescrição" para assinar e gerar o PDF.',
        });
      } else {
        toast.success('Rascunho salvo');
      }
      router.push(`/prescricoes/${newId}`);
    } catch (err) {
      toast.error('Falha ao criar prescrição', {
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
    }
  }

  const headerActions = (
    <>
      <Btn
        variant="glass"
        small
        icon="download"
        type="button"
        disabled={createMut.isPending}
        onClick={() => void submit(false)}
      >
        Salvar rascunho
      </Btn>
      <Btn
        variant="primary"
        small
        icon="shield"
        type="button"
        disabled={createMut.isPending}
        onClick={() => void submit(true)}
      >
        Continuar p/ emitir
      </Btn>
    </>
  );

  return (
    <div style={{ padding: 24, overflow: 'auto', flex: 1 }}>
      <PageHero
        eyebrow="Clínico"
        icon="file"
        module="clinical"
        title="Nova prescrição"
        description={(
          <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Link
              href={`/pacientes/${patient.id}/prontuario`}
              style={{ color: T.primary, textDecoration: 'none', fontWeight: 600 }}
            >
              {patient.name}
            </Link>
            {encounterId && (
              <>
                <span style={{ color: T.textMuted }}>·</span>
                <Mono size={11}>VINCULADA AO ATENDIMENTO {encounterId.slice(0, 8).toUpperCase()}</Mono>
              </>
            )}
          </span>
        )}
        actions={(
          <Link href={`/pacientes/${patient.id}/prontuario`}>
            <Btn variant="ghost" small icon="arrowLeft">Prontuário</Btn>
          </Link>
        )}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '320px minmax(0, 1fr) 480px',
          gap: 16,
          alignItems: 'start',
        }}
      >
        {/* LEFT */}
        <div style={{ position: 'sticky', top: 0, alignSelf: 'start' }}>
          <PrescriptionHistoryPanel
            patientId={patient.id}
            onSelect={(targetId) => router.push(`/prescricoes/${targetId}`)}
            onDuplicate={(sourceId) => router.push(`/prescricoes/${sourceId}`)}
          />
        </div>

        {/* CENTER */}
        <div>
          <PrescriptionBuilder
            value={draft}
            onChange={setDraft}
            allergies={allergies}
            disabled={createMut.isPending}
            headerActions={headerActions}
          />
        </div>

        {/* RIGHT */}
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
            prescriptionNumber={null}
            validUntil={fromDateInput(draft.validUntil) ?? null}
            isDraft
          />
          <p style={{ marginTop: 10, fontSize: 12, color: T.textMuted }}>
            Pré-visualização local — o PDF assinado só é gerado pelo backend após emitir a prescrição.
          </p>
        </div>
      </div>

      <AllergyConfirmDialog
        open={allergyDialogOpen}
        onOpenChange={(open) => {
          setAllergyDialogOpen(open);
          if (!open) setPendingSign(false);
        }}
        matches={conflicts}
        isLoading={createMut.isPending}
        onConfirm={() => void submit(pendingSign)}
        confirmLabel="Sim, salvar mesmo assim"
      />
    </div>
  );
}
