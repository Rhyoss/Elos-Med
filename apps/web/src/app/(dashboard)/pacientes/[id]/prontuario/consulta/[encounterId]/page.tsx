'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Badge, Glass, Btn, Ico, Mono, T,
} from '@dermaos/ui/ds';
import {
  AllergyBanner,
  Button,
  Input,
  LoadingSkeleton,
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

/* ── Glass section wrapper ───────────────────────────────────────────── */

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
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Mono size={11} spacing="1px" color={T.primary}>{label.toUpperCase()}</Mono>
        {action}
      </div>
      {children}
    </div>
  );
}

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
  const isSigned  = encounter?.status === 'assinado';

  /* ── Form state ──────────────────────────────────────────────────── */
  const [form, setForm]       = React.useState<FormState>(EMPTY_FORM);
  const lastSyncedRef         = React.useRef<FormState>(EMPTY_FORM);
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>({ kind: 'idle', lastSavedAt: null });
  const [signOpen, setSignOpen]   = React.useState(false);
  const [showNotes, setShowNotes] = React.useState(false);

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

  async function handleSign() {
    try {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      await persist();
      await signMut.mutateAsync({ id: encounterId });
      toast.success('Prontuário assinado');
      setSignOpen(false);
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
      <div style={{ padding: 24 }}>
        <Glass style={{ padding: 32, textAlign: 'center' }}>
          <Mono size={11} color={T.textMuted}>CARREGANDO ATENDIMENTO…</Mono>
        </Glass>
      </div>
    );
  }

  if (encounterQuery.isError || !encounter) {
    return (
      <div style={{ padding: 24 }}>
        <Glass style={{ padding: 32, textAlign: 'center' }}>
          <Ico name="alert" size={24} color={T.danger} />
          <p style={{ fontSize: 15, color: T.danger, marginTop: 8 }}>Atendimento não encontrado.</p>
          <div style={{ marginTop: 12 }}>
            <Link href={`/pacientes/${patientId}/prontuario`} style={{ textDecoration: 'none' }}>
              <Btn variant="glass" small icon="arrowLeft">Voltar ao prontuário</Btn>
            </Link>
          </div>
        </Glass>
      </div>
    );
  }

  const soapTextForAi = buildSoapTextForAi(form);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top bar */}
      <div
        style={{
          padding: '12px 22px',
          borderBottom: `1px solid ${T.divider}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href={`/pacientes/${patientId}/prontuario`} style={{ textDecoration: 'none' }}>
            <Btn variant="ghost" small iconOnly icon="arrowLeft" aria-label="Voltar ao prontuário" />
          </Link>
          <div>
            <p style={{ fontSize: 18, fontWeight: 700, color: T.textPrimary }}>
              {patient?.name ?? 'Atendimento'}
            </p>
            <Mono size={11}>{encounterId.slice(0, 8).toUpperCase()}</Mono>
          </div>
          <Badge variant={isSigned ? 'success' : 'default'} dot>
            {isSigned ? 'Assinado' : 'Em atendimento'}
          </Badge>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Glass
            metal
            style={{
              padding: '5px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              borderRadius: T.r.md,
            }}
          >
            <Ico name="clock" size={15} color={T.textMuted} />
            <span
              style={{
                fontSize: 15,
                fontFamily: "'IBM Plex Mono', monospace",
                fontVariantNumeric: 'tabular-nums',
                color: T.textPrimary,
                fontWeight: 600,
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
      </div>

      {/* Allergy banner */}
      {patient && patient.allergies.length > 0 && (
        <div style={{ padding: '0 22px', flexShrink: 0 }}>
          <AllergyBanner allergies={patient.allergies} />
        </div>
      )}

      {/* Main body — split panel */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Left: SOAP fields */}
        <section
          aria-labelledby="soap-heading"
          style={{
            flex: 1,
            minWidth: 0,
            overflowY: 'auto',
            padding: '18px 22px',
            borderRight: `1px solid ${T.divider}`,
          }}
        >
          <h2 id="soap-heading" className="sr-only">Campos SOAP</h2>
          <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Chief complaint */}
            <Glass style={{ padding: '16px 18px' }}>
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

            {/* Subjective */}
            <Glass style={{ padding: '16px 18px' }}>
              <SoapSection
                label="Subjetivo"
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
                  placeholder="História clínica, queixas, evolução…"
                  disabled={isSigned}
                  minHeight="7rem"
                />
              </SoapSection>
            </Glass>

            {/* Objective */}
            <Glass style={{ padding: '16px 18px' }}>
              <SoapSection label="Objetivo">
                <SoapEditor
                  label="Objetivo"
                  value={form.objective}
                  onChange={(v) => update('objective', v)}
                  placeholder="Exame físico, achados dermatológicos…"
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
            <Glass style={{ padding: '16px 18px' }}>
              <SoapSection label="Avaliação">
                <SoapEditor
                  label="Avaliação"
                  value={form.assessment}
                  onChange={(v) => update('assessment', v)}
                  placeholder="Impressão clínica, hipóteses diagnósticas…"
                  disabled={isSigned}
                  minHeight="6rem"
                />
              </SoapSection>
            </Glass>

            {/* Plan */}
            <Glass style={{ padding: '16px 18px' }}>
              <SoapSection label="Plano">
                <SoapEditor
                  label="Plano"
                  value={form.plan}
                  onChange={(v) => update('plan', v)}
                  placeholder="Conduta, prescrição, exames, orientações…"
                  disabled={isSigned}
                  minHeight="6rem"
                />
              </SoapSection>
            </Glass>

            {/* Internal notes (collapsible) */}
            <Glass style={{ padding: 0, overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setShowNotes(!showNotes)}
                style={{
                  width: '100%',
                  padding: '12px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Mono size={11} color={T.textMuted}>NOTAS INTERNAS (NÃO IMPRESSAS)</Mono>
                <span style={{ transform: showNotes ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.15s' }}>
                  <Ico name="chevDown" size={14} color={T.textMuted} />
                </span>
              </button>
              {showNotes && (
                <div style={{ padding: '0 18px 16px', borderTop: `1px solid ${T.divider}` }}>
                  <div style={{ paddingTop: 12 }}>
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
          </div>
        </section>

        {/* Right: Context panel */}
        <aside
          aria-labelledby="context-heading"
          style={{
            width: '38%',
            minWidth: 320,
            maxWidth: 480,
            overflowY: 'auto',
            padding: '18px 20px',
            background: 'rgba(242,242,242,0.5)',
            flexShrink: 0,
          }}
        >
          <h2 id="context-heading" className="sr-only">Contexto clínico</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Glass style={{ padding: '16px 18px' }}>
              <CidAutocomplete
                diagnoses={form.diagnoses}
                onChange={(d) => update('diagnoses', d)}
                soapText={soapTextForAi}
                disabled={isSigned}
              />
            </Glass>

            <Glass style={{ padding: '16px 18px' }}>
              <EncounterImages
                encounterId={encounterId}
                patientId={patientId}
                disabled={isSigned}
              />
            </Glass>

            <Glass style={{ padding: '16px 18px' }}>
              <EncounterPrescriptions
                encounterId={encounterId}
                patientId={patientId}
                disabled={isSigned}
              />
            </Glass>

            <Glass style={{ padding: '16px 18px' }}>
              <NextAppointmentSection
                value={form.nextAppointment}
                onChange={(v) => update('nextAppointment', v)}
                patientId={patientId}
                disabled={isSigned}
              />
            </Glass>
          </div>
        </aside>
      </div>

      {/* Bottom action bar */}
      <div
        style={{
          padding: '10px 22px',
          borderTop: `1px solid ${T.divider}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexShrink: 0,
          flexWrap: 'wrap',
          background: T.glass,
          backdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
          WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Glass metal style={{ padding: '6px 12px', borderRadius: T.r.md, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Ico name="clock" size={14} color={T.textMuted} />
            <span
              style={{
                fontSize: 14,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Btn
            variant="glass"
            small
            icon="download"
            onClick={() => void persist()}
            disabled={isSigned}
          >
            Salvar rascunho
          </Btn>
          <Btn
            variant="accent"
            small
            icon="shield"
            onClick={() => setSignOpen(true)}
            disabled={isSigned || signMut.isPending}
          >
            {isSigned ? 'Prontuário assinado' : 'Assinar e fechar'}
          </Btn>
        </div>
      </div>

      <SignModal
        open={signOpen}
        onOpenChange={setSignOpen}
        providerName={sessionUser?.name ?? 'Profissional'}
        providerCrm={sessionUser?.crm ?? null}
        onConfirm={handleSign}
        isSubmitting={signMut.isPending}
      />
    </div>
  );
}
