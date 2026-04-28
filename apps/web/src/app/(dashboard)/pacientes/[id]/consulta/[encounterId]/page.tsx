'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Sparkles } from 'lucide-react';
import {
  AllergyBanner,
  Input,
  LoadingSkeleton,
  useToast,
} from '@dermaos/ui';
import {
  Badge as DSBadge,
  Btn,
  Glass,
  Ico,
  MetalTag,
  Mono,
  T,
} from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
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

/* ── Form state ──────────────────────────────────────────────────────────── */

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

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function stripHtml(html: string): string {
  if (typeof document === 'undefined') return html;
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent ?? '';
}

function buildSoapTextForAi(form: FormState): string {
  const parts = [
    form.chiefComplaint ? `Queixa principal: ${form.chiefComplaint}` : '',
    form.subjective  ? `Subjetivo: ${stripHtml(form.subjective)}`   : '',
    form.objective   ? `Objetivo: ${stripHtml(form.objective)}`     : '',
    form.assessment  ? `Avaliação: ${stripHtml(form.assessment)}`   : '',
    form.plan        ? `Plano: ${stripHtml(form.plan)}`             : '',
  ];
  return parts.filter(Boolean).join('\n');
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

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function ConsultaPage({
  params,
}: {
  params: Promise<{ id: string; encounterId: string }>;
}) {
  const { id: patientId, encounterId } = React.use(params);
  const router = useRouter();
  const { toast } = useToast();
  const sessionUser = useAuthStore((s) => s.user);

  /* ── Queries ───────────────────────────────────────────────────────── */
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

  const isSigned = encounter?.status === 'assinado';

  /* ── Form state ────────────────────────────────────────────────────── */
  const [form, setForm]       = React.useState<FormState>(EMPTY_FORM);
  const lastSyncedRef         = React.useRef<FormState>(EMPTY_FORM);
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>({ kind: 'idle', lastSavedAt: null });
  const [signOpen, setSignOpen]   = React.useState(false);

  // Carrega form a partir do encounter quando disponível
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

  /* ── Timer da consulta ─────────────────────────────────────────────── */
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const startedAtRef = React.useRef<Date | null>(null);

  React.useEffect(() => {
    if (!encounter) return;
    startedAtRef.current = encounter.createdAt;
    const interval = setInterval(() => {
      const start = startedAtRef.current;
      if (!start) return;
      setElapsedMs(Date.now() - start.getTime());
    }, 1000);
    return () => clearInterval(interval);
  }, [encounter]);

  /* ── Mutations ─────────────────────────────────────────────────────── */
  const autoSaveMut    = trpc.clinical.encounters.autoSave.useMutation();
  const signMut        = trpc.clinical.encounters.sign.useMutation();
  const aiSoapMut      = trpc.clinical.encounters.aiSuggestSoap.useMutation();

  /* ── Auto-save ─────────────────────────────────────────────────────── */
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
    debounceTimerRef.current = setTimeout(() => {
      void persist();
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [persist]);

  // Agenda save sempre que o form muda (exceto sync inicial)
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

  // Dispara save ao fechar a página (beforeunload) — não promete sucesso, mas
  // tenta disparar o request. Reabertura usa o último rascunho persistido.
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

  /* ── Form handlers ─────────────────────────────────────────────────── */
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
      // Wrap content em parágrafos simples para o Tiptap
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
        description: err instanceof Error ? err.message : 'Tente novamente em instantes.',
      });
    }
  }

  async function handleSign() {
    try {
      // Garante que qualquer rascunho pendente vai antes
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

  /* ── Loading / error states ───────────────────────────────────────── */
  if (encounterQuery.isLoading) {
    return (
      <div className="space-y-4 p-6">
        <LoadingSkeleton className="h-8 w-1/2 rounded" />
        <LoadingSkeleton className="h-64 w-full rounded" />
      </div>
    );
  }

  if (encounterQuery.isError || !encounter) {
    return (
      <div className="p-6 text-sm text-danger-700">
        Atendimento não encontrado.
      </div>
    );
  }

  /* ── Render ───────────────────────────────────────────────────────── */
  const soapTextForAi = buildSoapTextForAi(form);

  return (
    <div className="flex h-full flex-col">
      {/* Top bar — DS Quite Clear */}
      <div
        style={{
          borderBottom: `1px solid ${T.divider}`,
          background: T.glass,
          backdropFilter: `blur(${T.glassBlur}px) saturate(160%)`,
          WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(160%)`,
          padding: '14px 26px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: isSigned ? T.textMuted : T.success,
                    boxShadow: isSigned ? 'none' : `0 0 8px ${T.success}40`,
                  }}
                />
                <Mono size={9} spacing="1px" color={isSigned ? T.textMuted : T.success}>
                  {isSigned ? 'CONSULTA ASSINADA' : 'CONSULTA EM ANDAMENTO'}
                </Mono>
              </div>
              <p
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: T.textPrimary,
                  margin: 0,
                  letterSpacing: '-0.01em',
                }}
              >
                {patient?.name ?? 'Atendimento'}
              </p>
              <Mono size={9}>
                {sessionUser?.name ?? 'Profissional'}
                {sessionUser?.crm ? ` · ${sessionUser.crm}` : ''}
              </Mono>
            </div>
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: T.r.pill,
              background: T.glass,
              border: `1px solid ${T.glassBorder}`,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 13,
              fontVariantNumeric: 'tabular-nums',
              color: T.textPrimary,
            }}
            role="timer"
            aria-label="Duração da consulta"
          >
            <Ico name="clock" size={14} color={T.textMuted} />
            {formatElapsed(elapsedMs)}
          </div>
        </div>
        {patient && patient.allergies.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <AllergyBanner allergies={patient.allergies} />
          </div>
        )}
      </div>

      {/* Corpo principal — split panel */}
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        {/* ── Esquerda: campos SOAP ───────────────────────────────────── */}
        <section
          aria-labelledby="soap-heading"
          className="flex-1 min-w-0 overflow-y-auto border-b border-border p-6 lg:w-[60%] lg:border-b-0 lg:border-r"
        >
          <div className="mx-auto max-w-3xl space-y-5">
            <h2 id="soap-heading" className="sr-only">Campos SOAP</h2>

            <SoapBox letter="C" label="QUEIXA PRINCIPAL">
              <Input
                id="chief-complaint"
                value={form.chiefComplaint}
                onChange={(e) => update('chiefComplaint', e.target.value)}
                placeholder="Ex: Lesão na face em crescimento há 3 semanas"
                disabled={isSigned}
                maxLength={2000}
                aria-label="Queixa principal"
              />
            </SoapBox>

            <SoapBox
              letter="S"
              label="SUBJETIVO"
              action={
                <Btn
                  variant="ghost"
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
            </SoapBox>

            <SoapBox letter="O" label="OBJETIVO — EXAME FÍSICO">
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
            </SoapBox>

            <SoapBox letter="A" label="AVALIAÇÃO — DIAGNÓSTICO">
              <SoapEditor
                label="Avaliação"
                value={form.assessment}
                onChange={(v) => update('assessment', v)}
                placeholder="Impressão clínica, hipóteses diagnósticas…"
                disabled={isSigned}
                minHeight="6rem"
              />
            </SoapBox>

            <SoapBox letter="P" label="PLANO — CONDUTA">
              <SoapEditor
                label="Plano"
                value={form.plan}
                onChange={(v) => update('plan', v)}
                placeholder="Conduta, prescrição, exames solicitados, orientações…"
                disabled={isSigned}
                minHeight="6rem"
              />
            </SoapBox>

            <details
              style={{
                borderRadius: T.r.lg,
                background: T.glass,
                border: `1px solid ${T.glassBorder}`,
                overflow: 'hidden',
              }}
            >
              <summary
                style={{
                  cursor: 'pointer',
                  userSelect: 'none',
                  padding: '10px 14px',
                  fontSize: 11,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontWeight: 500,
                  letterSpacing: '1.1px',
                  color: T.textMuted,
                }}
              >
                NOTAS INTERNAS — NÃO IMPRESSAS
              </summary>
              <div style={{ borderTop: `1px solid ${T.divider}`, padding: 12 }}>
                <SoapEditor
                  label="Notas internas"
                  value={form.internalNotes}
                  onChange={(v) => update('internalNotes', v)}
                  placeholder="Observações privadas do profissional…"
                  disabled={isSigned}
                  minHeight="5rem"
                />
              </div>
            </details>
          </div>
        </section>

        {/* ── Direita: contexto ───────────────────────────────────────── */}
        <aside
          aria-labelledby="context-heading"
          className="flex-shrink-0 overflow-y-auto bg-muted/20 p-6 lg:w-[40%]"
        >
          <h2 id="context-heading" className="sr-only">Contexto clínico</h2>
          <div className="space-y-6">
            <CidAutocomplete
              diagnoses={form.diagnoses}
              onChange={(d) => update('diagnoses', d)}
              soapText={soapTextForAi}
              disabled={isSigned}
            />

            <EncounterImages
              encounterId={encounterId}
              patientId={patientId}
              disabled={isSigned}
            />

            <EncounterPrescriptions
              encounterId={encounterId}
              patientId={patientId}
              disabled={isSigned}
            />

            <NextAppointmentSection
              value={form.nextAppointment}
              onChange={(v) => update('nextAppointment', v)}
              patientId={patientId}
              disabled={isSigned}
            />
          </div>
        </aside>
      </div>

      {/* Barra inferior sticky — DS Quite Clear */}
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          zIndex: 10,
          borderTop: `1px solid ${T.divider}`,
          background: T.glass,
          backdropFilter: `blur(${T.glassBlur}px) saturate(160%)`,
          WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(160%)`,
          padding: '12px 26px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: T.r.pill,
              background: T.glass,
              border: `1px solid ${T.glassBorder}`,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              color: T.textMuted,
              fontVariantNumeric: 'tabular-nums',
            }}
            aria-label="Tempo de atendimento"
          >
            <Ico name="clock" size={12} color={T.textMuted} />
            {formatElapsed(elapsedMs)}
          </div>
          <SaveStatusIndicator
            status={saveStatus}
            onRetry={saveStatus.kind === 'error' ? () => void persist() : undefined}
          />
          <div style={{ display: 'flex', gap: 4 }}>
            <MetalTag>LGPD</MetalTag>
            <MetalTag>PHI-SAFE</MetalTag>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Btn
            variant="ghost"
            small
            icon="download"
            onClick={() => void persist()}
            disabled={isSigned}
          >
            Salvar rascunho
          </Btn>
          <Btn
            small
            icon="check"
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

/* ── Local UI helpers ────────────────────────────────────────────────────── */

/**
 * SOAP box — Glass card with letter pill (S/O/A/P/C) on the left and label
 * on top, matching the ConsultaViva reference design.
 */
function SoapBox({
  letter,
  label,
  action,
  children,
}: {
  letter:   string;
  label:    string;
  action?:  React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Glass style={{ padding: '16px 18px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: T.r.sm,
              background: T.primaryBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: T.primary,
                fontFamily: "'IBM Plex Sans', sans-serif",
              }}
            >
              {letter}
            </span>
          </div>
          <Mono size={9} spacing="1px" color={T.primary}>
            {label}
          </Mono>
        </div>
        {action}
      </div>
      {children}
    </Glass>
  );
}
