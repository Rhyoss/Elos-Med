'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Badge, Glass, Btn, Ico, Mono, T,
} from '@dermaos/ui/ds';
import {
  AllergyBanner,
  useToast,
} from '@dermaos/ui';
import { trpc } from '@/lib/trpc-provider';
import { useAuthStore } from '@/stores/auth-store';
import type {
  EncounterDiagnosisInput,
  NextAppointmentHint,
  VitalSignsInput,
  AutoSaveEncounterInput,
} from '@dermaos/shared';

import { SoapEditor } from './_components/soap-editor';
import { VitalSignsForm } from './_components/vital-signs';
import { CidAutocomplete } from './_components/cid-autocomplete';
import { NextAppointmentSection } from './_components/next-appointment';
import { SignModal } from './_components/sign-modal';
import { EncounterImages } from './_components/encounter-images';
import { EncounterPrescriptions } from './_components/encounter-prescriptions';
import { SaveStatusIndicator, type SaveStatus } from './_components/save-status';
import { EncounterPatientSidebar } from './_components/encounter-patient-sidebar';
import { EncounterActionsPanel } from './_components/encounter-actions-panel';
import { PrescriptionDrawer } from './_components/prescription-drawer';
import { FinalizationDialog } from './_components/finalization-dialog';
import { AddendumModal } from './_components/addendum-modal';
import type { TemplateSection } from './_components/template-panel';
import styles from './encounter.module.css';

/* ── Form state ──────────────────────────────────────────────────────── */

interface FormState {
  chiefComplaint: string;
  subjective:     string;
  objective:      string;
  assessment:     string;
  plan:           string;
  internalNotes:  string;
  diagnoses:      EncounterDiagnosisInput[];
  vitalSigns:     VitalSignsInput;
  nextAppointment: NextAppointmentHint;
}

const EMPTY_FORM: FormState = {
  chiefComplaint: '',
  subjective:     '',
  objective:      '',
  assessment:     '',
  plan:           '',
  internalNotes:  '',
  diagnoses:      [],
  vitalSigns:     {},
  nextAppointment: { enabled: false, intervalDays: 30 },
};

const AUTOSAVE_DEBOUNCE_MS = 15_000;

/* ── Helpers ─────────────────────────────────────────────────────────── */

function stripHtml(html: string): string {
  if (typeof document === 'undefined') return html;
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent ?? '';
}

function buildSoapTextForAi(form: FormState): string {
  return [
    form.chiefComplaint ? `Queixa principal: ${form.chiefComplaint}` : '',
    form.subjective  ? `Subjetivo: ${stripHtml(form.subjective)}`   : '',
    form.objective   ? `Objetivo: ${stripHtml(form.objective)}`     : '',
    form.assessment  ? `Avaliação: ${stripHtml(form.assessment)}`   : '',
    form.plan        ? `Plano: ${stripHtml(form.plan)}`             : '',
  ].filter(Boolean).join('\n');
}

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

function shallowDiff(a: FormState, b: FormState): Partial<FormState> {
  const diff: Partial<FormState> = {};
  (Object.keys(a) as (keyof FormState)[]).forEach((key) => {
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
      (diff[key] as unknown) = a[key];
    }
  });
  return diff;
}

/* ── SOAP section wrapper ───────────────────────────────────────────── */

function SoapSection({
  label,
  action,
  children,
}: {
  label:    string;
  action?:  React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.soapSection}>
      <div className={styles.soapHeader}>
        <Mono size={10} spacing="1px" color={T.primary}>{label.toUpperCase()}</Mono>
        {action}
      </div>
      {children}
    </div>
  );
}

/* ── Status labels ───────────────────────────────────────────────────── */

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' }> = {
  rascunho: { label: 'Rascunho', variant: 'default' },
  revisao:  { label: 'Em revisão', variant: 'warning' },
  assinado: { label: 'Assinado', variant: 'success' },
  corrigido:{ label: 'Corrigido', variant: 'info' },
};

/* ── Page ────────────────────────────────────────────────────────────── */

export default function ConsultaPage({
  params,
}: {
  params: Promise<{ id: string; encounterId: string }>;
}) {
  const { id: patientId, encounterId } = React.use(params);
  const router = useRouter();
  const { toast } = useToast();
  const sessionUser = useAuthStore((s) => s.user);

  /* ── Queries ─────────────────────────────────────────────────────── */
  const encounterQuery = trpc.clinical.encounters.getById.useQuery(
    { id: encounterId },
    { staleTime: 0, refetchOnWindowFocus: false },
  );
  const patientQuery = trpc.patients.getById.useQuery(
    { id: patientId },
    { enabled: !!patientId, staleTime: 30_000 },
  );

  const encounter = encounterQuery.data?.encounter;
  const patient   = patientQuery.data?.patient;
  const isSigned  = encounter?.status === 'assinado' || encounter?.status === 'corrigido';
  const statusInfo = STATUS_MAP[encounter?.status ?? ''] ?? { label: 'Rascunho', variant: 'default' as const };

  /* ── Modals state ────────────────────────────────────────────────── */
  const [signOpen, setSignOpen]           = React.useState(false);
  const [prescriptionOpen, setPrescriptionOpen] = React.useState(false);
  const [finalizationOpen, setFinalizationOpen] = React.useState(false);
  const [addendumOpen, setAddendumOpen]   = React.useState(false);
  const [showNotes, setShowNotes]         = React.useState(false);

  /* ── Form state ──────────────────────────────────────────────────── */
  const [form, setForm]       = React.useState<FormState>(EMPTY_FORM);
  const lastSyncedRef         = React.useRef<FormState>(EMPTY_FORM);
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>({ kind: 'idle', lastSavedAt: null });

  React.useEffect(() => {
    if (!encounter) return;
    const loaded: FormState = {
      chiefComplaint: encounter.chiefComplaint ?? '',
      subjective:     encounter.subjective     ?? '',
      objective:      encounter.objective      ?? '',
      assessment:     encounter.assessment     ?? '',
      plan:           encounter.plan           ?? '',
      internalNotes:  encounter.internalNotes  ?? '',
      diagnoses:      encounter.diagnoses.map((d) => ({
        code:        d.code,
        description: d.description,
        isPrimary:   d.isPrimary,
        aiGenerated: d.aiGenerated,
        confidence:  d.confidence,
      })),
      vitalSigns: encounter.vitalSigns
        ? {
            bloodPressureSys: encounter.vitalSigns.bloodPressureSys ?? undefined,
            bloodPressureDia: encounter.vitalSigns.bloodPressureDia ?? undefined,
            heartRate:        encounter.vitalSigns.heartRate        ?? undefined,
            temperatureC:     encounter.vitalSigns.temperatureC     ?? undefined,
            oxygenSaturation: encounter.vitalSigns.oxygenSaturation ?? undefined,
            weightKg:         encounter.vitalSigns.weightKg         ?? undefined,
            heightCm:         encounter.vitalSigns.heightCm         ?? undefined,
            notes:            encounter.vitalSigns.notes            ?? undefined,
          }
        : {},
      nextAppointment: encounter.nextAppointment ?? { enabled: false, intervalDays: 30 },
    };
    setForm(loaded);
    lastSyncedRef.current = loaded;
    setSaveStatus({ kind: 'idle', lastSavedAt: encounter.updatedAt });
  }, [encounter]);

  /* ── Timer ───────────────────────────────────────────────────────── */
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const startedAtRef = React.useRef<Date | null>(null);

  React.useEffect(() => {
    if (!encounter) return;
    startedAtRef.current = encounter.createdAt;
    const interval = setInterval(() => {
      if (startedAtRef.current) setElapsedMs(Date.now() - startedAtRef.current.getTime());
    }, 1000);
    return () => clearInterval(interval);
  }, [encounter]);

  /* ── Cache utils ─────────────────────────────────────────────────── */
  const utils = trpc.useUtils();

  /* ── Mutations ───────────────────────────────────────────────────── */
  const autoSaveMut = trpc.clinical.encounters.autoSave.useMutation();
  const signMut     = trpc.clinical.encounters.sign.useMutation();
  const aiSoapMut   = trpc.clinical.encounters.aiSuggestSoap.useMutation();

  /* ── Auto-save ───────────────────────────────────────────────────── */
  const debounceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = React.useCallback(async () => {
    if (isSigned) return;
    const current = form;
    const diff = shallowDiff(current, lastSyncedRef.current);
    if (Object.keys(diff).length === 0) return;

    setSaveStatus((prev) => ({ kind: 'saving', lastSavedAt: prev.kind === 'saved' ? prev.lastSavedAt : prev.lastSavedAt }));

    const payload: AutoSaveEncounterInput = {
      chiefComplaint: diff.chiefComplaint,
      subjective:     diff.subjective,
      objective:      diff.objective,
      assessment:     diff.assessment,
      plan:           diff.plan,
      internalNotes:  diff.internalNotes,
      diagnoses:      diff.diagnoses,
      vitalSigns:     diff.vitalSigns,
      structuredData: diff.nextAppointment ? { nextAppointment: diff.nextAppointment } : undefined,
    };

    try {
      const res = await autoSaveMut.mutateAsync({ id: encounterId, data: payload });
      lastSyncedRef.current = current;
      setSaveStatus({ kind: 'saved', lastSavedAt: new Date(res.savedAt) });
    } catch (err) {
      setSaveStatus({
        kind:    'error',
        message: err instanceof Error ? err.message : 'Falha ao salvar',
        lastSavedAt: saveStatus.kind === 'saved' ? saveStatus.lastSavedAt : null,
      });
    }
  }, [autoSaveMut, encounterId, form, isSigned, saveStatus]);

  const scheduleSave = React.useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => { void persist(); }, AUTOSAVE_DEBOUNCE_MS);
  }, [persist]);

  const formSignatureRef = React.useRef<string>('');
  React.useEffect(() => {
    const signature = JSON.stringify(form);
    if (formSignatureRef.current === '' || formSignatureRef.current === signature) {
      formSignatureRef.current = signature;
      return;
    }
    formSignatureRef.current = signature;
    if (isSigned) return;
    scheduleSave();
  }, [form, scheduleSave, isSigned]);

  React.useEffect(() => {
    function beforeUnload() {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        void persist();
      }
    }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [persist]);

  /* ── Form handlers ─────────────────────────────────────────────── */
  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSuggestSoap() {
    if (!form.chiefComplaint.trim()) {
      toast.warning('Informe a queixa principal antes de pedir sugestão');
      return;
    }
    try {
      const res = await aiSoapMut.mutateAsync({
        chiefComplaint: form.chiefComplaint,
        patientHistory: [
          patient?.chronicConditions?.length ? `Crônicas: ${patient.chronicConditions.join(', ')}` : '',
          patient?.activeMedications?.length ? `Medicações: ${patient.activeMedications.join(', ')}` : '',
        ].filter(Boolean).join(' · '),
      });
      const { draft } = res;
      setForm((prev) => ({
        ...prev,
        subjective: draft.subjective ? `<p>${draft.subjective}</p>` : prev.subjective,
        objective:  draft.objective  ? `<p>${draft.objective}</p>`  : prev.objective,
        assessment: draft.assessment ? `<p>${draft.assessment}</p>` : prev.assessment,
        plan:       draft.plan       ? `<p>${draft.plan}</p>`       : prev.plan,
      }));
      toast.info('Rascunho SOAP sugerido pela IA', {
        description: 'Revise cuidadosamente antes de aceitar ou editar.',
      });
    } catch (err) {
      toast.error('Assistente indisponível', {
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
    }
  }

  /* ── Template application ────────────────────────────────────────── */
  function handleApplyTemplate(sections: TemplateSection[]) {
    const hasContent = form.subjective || form.objective || form.assessment || form.plan;
    if (hasContent) {
      const confirmed = window.confirm(
        'Já existem dados nos campos SOAP. O template será mesclado ao conteúdo existente. Deseja continuar?',
      );
      if (!confirmed) return;
    }

    setForm((prev) => {
      const next = { ...prev };
      for (const section of sections) {
        const key = section.key as keyof FormState;
        if (key === 'subjective' || key === 'objective' || key === 'assessment' || key === 'plan') {
          const existing = prev[key] as string;
          if (existing && stripHtml(existing).trim()) {
            next[key] = existing + section.content;
          } else {
            next[key] = section.content;
          }
        }
      }
      return next;
    });
  }

  /* ── Sign flow ───────────────────────────────────────────────────── */
  async function handleSign() {
    try {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      await persist();
      await signMut.mutateAsync({ id: encounterId });

      void utils.clinical.encounters.getById.invalidate({ id: encounterId });
      void utils.clinical.encounters.getByPatient.invalidate({ patientId });
      void utils.patients.getById.invalidate({ id: patientId });
      void utils.scheduling.agendaDay.invalidate();

      toast.success('Prontuário assinado');
      setSignOpen(false);
      setFinalizationOpen(false);
      router.push(`/pacientes/${patientId}/prontuario`);
    } catch (err) {
      toast.error('Não foi possível assinar', {
        description: err instanceof Error ? err.message : 'Erro desconhecido',
      });
    }
  }

  /* ── Loading / error ─────────────────────────────────────────────── */
  if (encounterQuery.isLoading) {
    return (
      <div style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
        <Glass style={{ padding: 32, textAlign: 'center' }}>
          <div
            style={{
              width: 24,
              height: 24,
              border: `2px solid ${T.primary}`,
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 12px',
            }}
          />
          <Mono size={10} color={T.textMuted}>CARREGANDO ATENDIMENTO…</Mono>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </Glass>
      </div>
    );
  }

  if (encounterQuery.isError || !encounter) {
    return (
      <div style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
        <Glass style={{ padding: 32, textAlign: 'center', maxWidth: 400 }}>
          <Ico name="alert" size={24} color={T.danger} />
          <p style={{ fontSize: 15, color: T.danger, marginTop: 8 }}>Atendimento não encontrado.</p>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center' }}>
            <Link href={`/pacientes/${patientId}/prontuario`} style={{ textDecoration: 'none' }}>
              <Btn variant="glass" small icon="arrowLeft">Voltar ao prontuário</Btn>
            </Link>
            <Link href="/agenda" style={{ textDecoration: 'none' }}>
              <Btn variant="ghost" small icon="calendar">Ir para agenda</Btn>
            </Link>
          </div>
        </Glass>
      </div>
    );
  }

  const soapTextForAi = buildSoapTextForAi(form);

  return (
    <div className={styles.layout}>
      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div className={styles.topBar} style={{ borderBottom: `1px solid ${T.divider}` }}>
        <div className={styles.topBarLeft}>
          <Link href={`/pacientes/${patientId}/prontuario`} style={{ textDecoration: 'none' }}>
            <Btn variant="ghost" small iconOnly icon="arrowLeft" aria-label="Voltar ao prontuário" />
          </Link>
          <div>
            <p style={{ fontSize: 17, fontWeight: 700, color: T.textPrimary, margin: 0 }}>
              {patient?.name ?? 'Atendimento'}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
              <Mono size={10}>{encounterId.slice(0, 8).toUpperCase()}</Mono>
              <Badge variant={statusInfo.variant} dot>
                {statusInfo.label}
              </Badge>
            </div>
          </div>
        </div>

        <div className={styles.topBarRight}>
          <Glass metal className={styles.timerPill} style={{ borderRadius: T.r.md }}>
            <Ico name="clock" size={14} color={T.textMuted} />
            <span style={{ color: T.textPrimary }}>
              {formatElapsed(elapsedMs)}
            </span>
          </Glass>
          <SaveStatusIndicator
            status={saveStatus}
            onRetry={saveStatus.kind === 'error' ? () => void persist() : undefined}
          />
        </div>
      </div>

      {/* ── Allergy banner ────────────────────────────────────────────── */}
      {patient && patient.allergies.length > 0 && (
        <div style={{ padding: '0 18px', flexShrink: 0 }}>
          <AllergyBanner allergies={patient.allergies} />
        </div>
      )}

      {/* ── 3-column body ─────────────────────────────────────────────── */}
      <div className={styles.body}>
        {/* LEFT — Patient sidebar */}
        <div className={styles.sidebarLeft}>
          <EncounterPatientSidebar
            patientId={patientId}
            encounterId={encounterId}
          />
        </div>

        {/* CENTER — Clinical editor */}
        <section
          aria-labelledby="soap-heading"
          className={styles.center}
          style={{ borderLeft: `1px solid ${T.divider}`, borderRight: `1px solid ${T.divider}` }}
        >
          <h2 id="soap-heading" className="sr-only">Editor clínico SOAP</h2>
          <div className={styles.centerInner}>
            {/* Chief complaint */}
            <Glass style={{ padding: '14px 16px' }}>
              <SoapSection label="Queixa Principal">
                <input
                  value={form.chiefComplaint}
                  onChange={(e) => update('chiefComplaint', e.target.value)}
                  placeholder="Ex: Lesão na face em crescimento há 3 semanas"
                  disabled={isSigned}
                  maxLength={2000}
                  aria-label="Queixa principal"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: T.r.md,
                    background: T.glass,
                    backdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
                    WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
                    border: `1px solid ${T.glassBorder}`,
                    fontSize: 15,
                    color: T.textPrimary,
                    fontFamily: "'IBM Plex Sans', sans-serif",
                    fontWeight: 500,
                    outline: 'none',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = T.primaryBorder; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = T.glassBorder; }}
                />
              </SoapSection>
            </Glass>

            {/* Subjective / HDA */}
            <Glass style={{ padding: '14px 16px' }}>
              <SoapSection
                label="Subjetivo / HDA"
                action={
                  <Btn
                    variant="glass"
                    small
                    icon="zap"
                    onClick={handleSuggestSoap}
                    disabled={isSigned || aiSoapMut.isPending}
                  >
                    {aiSoapMut.isPending ? 'Gerando…' : 'IA: Sugerir'}
                  </Btn>
                }
              >
                <SoapEditor
                  label="Subjetivo"
                  value={form.subjective}
                  onChange={(v) => update('subjective', v)}
                  placeholder="História clínica, queixas, evolução, antecedentes, medicamentos, alergias…"
                  disabled={isSigned}
                  minHeight="7rem"
                />
              </SoapSection>
            </Glass>

            {/* Objective / Exam */}
            <Glass style={{ padding: '14px 16px' }}>
              <SoapSection label="Exame Físico Dermatológico">
                <SoapEditor
                  label="Objetivo"
                  value={form.objective}
                  onChange={(v) => update('objective', v)}
                  placeholder="Descrição das lesões, localização, distribuição, dermoscopia, achados…"
                  disabled={isSigned}
                  minHeight="7rem"
                />
                <div style={{ marginTop: 12 }}>
                  <VitalSignsForm
                    value={form.vitalSigns}
                    onChange={(v) => update('vitalSigns', v)}
                    disabled={isSigned}
                  />
                </div>
              </SoapSection>
            </Glass>

            {/* Assessment */}
            <Glass style={{ padding: '14px 16px' }}>
              <SoapSection label="Hipóteses / Diagnóstico">
                <SoapEditor
                  label="Avaliação"
                  value={form.assessment}
                  onChange={(v) => update('assessment', v)}
                  placeholder="Impressão clínica, hipóteses diagnósticas, dermoscopia…"
                  disabled={isSigned}
                  minHeight="5rem"
                />
                <div style={{ marginTop: 12 }}>
                  <CidAutocomplete
                    diagnoses={form.diagnoses}
                    onChange={(d) => update('diagnoses', d)}
                    soapText={soapTextForAi}
                    disabled={isSigned}
                  />
                </div>
              </SoapSection>
            </Glass>

            {/* Plan / Conduta */}
            <Glass style={{ padding: '14px 16px' }}>
              <SoapSection label="Conduta / Plano">
                <SoapEditor
                  label="Plano"
                  value={form.plan}
                  onChange={(v) => update('plan', v)}
                  placeholder="Conduta terapêutica, prescrição, orientações, exames solicitados…"
                  disabled={isSigned}
                  minHeight="5rem"
                />
              </SoapSection>
            </Glass>

            {/* Next appointment — inline in center */}
            <Glass style={{ padding: '14px 16px' }}>
              <NextAppointmentSection
                value={form.nextAppointment}
                onChange={(v) => update('nextAppointment', v)}
                patientId={patientId}
                disabled={isSigned}
              />
            </Glass>

            {/* Internal notes (collapsible) */}
            <Glass style={{ padding: 0, overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setShowNotes(!showNotes)}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Mono size={10} color={T.textMuted}>NOTAS INTERNAS (NÃO IMPRESSAS)</Mono>
                <span style={{ transform: showNotes ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.15s' }}>
                  <Ico name="chevDown" size={14} color={T.textMuted} />
                </span>
              </button>
              {showNotes && (
                <div style={{ padding: '0 16px 14px', borderTop: `1px solid ${T.divider}` }}>
                  <div style={{ paddingTop: 10 }}>
                    <SoapEditor
                      label="Notas internas"
                      value={form.internalNotes}
                      onChange={(v) => update('internalNotes', v)}
                      placeholder="Observações privadas do profissional…"
                      disabled={isSigned}
                      minHeight="5rem"
                    />
                  </div>
                </div>
              )}
            </Glass>

            {/* Linked content — Images & Prescriptions (inline for mobile when sidebar hidden) */}
            <Glass style={{ padding: '14px 16px' }}>
              <EncounterImages
                encounterId={encounterId}
                patientId={patientId}
                disabled={isSigned}
              />
            </Glass>

            <Glass style={{ padding: '14px 16px' }}>
              <EncounterPrescriptions
                encounterId={encounterId}
                patientId={patientId}
                disabled={isSigned}
              />
            </Glass>
          </div>
        </section>

        {/* RIGHT — Actions panel */}
        <aside
          aria-labelledby="actions-heading"
          className={styles.sidebarRight}
        >
          <h2 id="actions-heading" className="sr-only">Ações do atendimento</h2>
          <EncounterActionsPanel
            encounterId={encounterId}
            patientId={patientId}
            isSigned={isSigned}
            saveStatus={saveStatus}
            onPersist={() => void persist()}
            onOpenPrescription={() => setPrescriptionOpen(true)}
            onOpenFinalization={() => setFinalizationOpen(true)}
            onOpenAddendum={() => setAddendumOpen(true)}
            onApplyTemplate={handleApplyTemplate}
          />
        </aside>
      </div>

      {/* ── Bottom bar ─────────────────────────────────────────────────── */}
      <div
        className={styles.bottomBar}
        style={{
          borderTop: `1px solid ${T.divider}`,
          background: T.glass,
          backdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
          WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
        }}
      >
        <div className={styles.bottomBarLeft}>
          <Glass metal style={{ padding: '5px 10px', borderRadius: T.r.md, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Ico name="clock" size={13} color={T.textMuted} />
            <span
              style={{
                fontSize: 13,
                fontFamily: "'IBM Plex Mono', monospace",
                fontVariantNumeric: 'tabular-nums',
                color: T.textSecondary,
              }}
            >
              {formatElapsed(elapsedMs)}
            </span>
          </Glass>
          <SaveStatusIndicator
            status={saveStatus}
            onRetry={saveStatus.kind === 'error' ? () => void persist() : undefined}
          />
        </div>
        <div className={styles.bottomBarRight}>
          {!isSigned && (
            <>
              <Btn
                variant="glass"
                small
                icon="download"
                onClick={() => void persist()}
              >
                Salvar rascunho
              </Btn>
              <Btn
                variant="accent"
                small
                icon="shield"
                onClick={() => setFinalizationOpen(true)}
              >
                Finalizar atendimento
              </Btn>
            </>
          )}
          {isSigned && (
            <Btn
              variant="glass"
              small
              icon="edit"
              onClick={() => setAddendumOpen(true)}
            >
              Adicionar adendo
            </Btn>
          )}
        </div>
      </div>

      {/* ── Modals / Drawers ────────────────────────────────────────── */}
      <FinalizationDialog
        open={finalizationOpen}
        onOpenChange={setFinalizationOpen}
        onConfirmSign={handleSign}
        isSubmitting={signMut.isPending}
        chiefComplaint={form.chiefComplaint}
        objective={form.objective}
        assessment={form.assessment}
        plan={form.plan}
        diagnoses={form.diagnoses}
      />

      <SignModal
        open={signOpen}
        onOpenChange={setSignOpen}
        providerName={sessionUser?.name ?? 'Profissional'}
        providerCrm={sessionUser?.crm ?? null}
        onConfirm={handleSign}
        isSubmitting={signMut.isPending}
      />

      <PrescriptionDrawer
        open={prescriptionOpen}
        onOpenChange={setPrescriptionOpen}
        patientId={patientId}
        encounterId={encounterId}
        allergies={patient?.allergies ?? []}
      />

      <AddendumModal
        open={addendumOpen}
        onOpenChange={setAddendumOpen}
        encounterId={encounterId}
        patientId={patientId}
      />
    </div>
  );
}
