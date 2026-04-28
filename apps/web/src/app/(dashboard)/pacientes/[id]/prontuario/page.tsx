"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Btn, Glass, Ico, Mono, T } from "@dermaos/ui/ds";
import { useToast } from "@dermaos/ui";
import { trpc } from "@/lib/trpc-provider";
import { useAuthStore } from "@/stores/auth-store";

import { PatientRecordHeader } from "./_components/patient-record-header";
import { RecordTimeline } from "./_components/record-timeline";
import { RecordContextPanel } from "./_components/record-context-panel";
import { RecordViewer } from "./_components/record-viewer";
import {
  RecordEditor,
  type EditorFormState,
  type SaveStatus,
} from "./_components/record-editor";
import { RecordFinalizeDialog } from "./_components/record-finalize-dialog";
import {
  RecordShareDialog,
  type SharePayload,
} from "./_components/record-share-dialog";
import {
  isFinalized,
  type EncounterFull,
  type EncounterListItem,
  type RecordType,
} from "./_components/types";

type PageParams = Promise<{ id: string }>;
type Mode = "empty" | "view" | "edit";

const AUTOSAVE_DEBOUNCE_MS = 8_000;

const EMPTY_FORM: EditorFormState = {
  type: "clinical",
  chiefComplaint: "",
  subjective: "",
  objective: "",
  assessment: "",
  plan: "",
  internalNotes: "",
  diagnoses: [],
  vitals: {},
};

export default function ProntuarioPage({ params }: { params: PageParams }) {
  const { id: patientId } = React.use(params);
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const sessionUser = useAuthStore((s) => s.user);

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<Mode>("empty");
  const [form, setForm] = React.useState<EditorFormState>(EMPTY_FORM);
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>({
    kind: "idle",
  });
  const [finalizeOpen, setFinalizeOpen] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);

  // Viewport-aware: keep the workspace usable on tablets/mobile.
  const [timelineCollapsed, setTimelineCollapsed] = React.useState(false);
  const [contextCollapsed, setContextCollapsed] = React.useState(false);
  React.useEffect(() => {
    function update() {
      setTimelineCollapsed(window.innerWidth < 920);
      setContextCollapsed(window.innerWidth < 1220);
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Queries
  const patientQ = trpc.patients.getById.useQuery(
    { id: patientId },
    { staleTime: 30_000 },
  );
  const encountersQ = trpc.clinical.encounters.getByPatient.useQuery(
    { patientId, page: 1, pageSize: 50 },
    { staleTime: 15_000 },
  );
  const selectedEncounterQ = trpc.clinical.encounters.getById.useQuery(
    { id: selectedId ?? "" },
    { enabled: !!selectedId, staleTime: 10_000 },
  );

  // Context queries
  const prescriptionsQ = trpc.clinical.prescriptions.listByPatient.useQuery(
    { patientId, page: 1, pageSize: 5 },
    { staleTime: 30_000 },
  );
  const lesionsQ = trpc.clinical.lesions.listByPatient.useQuery(
    { patientId },
    { staleTime: 30_000 },
  );
  const protocolsQ = trpc.clinical.protocols.listByPatient.useQuery(
    { patientId },
    { staleTime: 30_000 },
  );
  const financialQ = trpc.financial.invoices.patientSummary.useQuery(
    { patientId },
    { staleTime: 30_000 },
  );

  // Mutations
  const autoSaveMut = trpc.clinical.encounters.autoSave.useMutation();
  const signMut = trpc.clinical.encounters.sign.useMutation();
  const aiSoapMut = trpc.clinical.encounters.aiSuggestSoap.useMutation();
  const createAppointmentMut = trpc.scheduling.create.useMutation();
  const createEncounterMut = trpc.clinical.encounters.create.useMutation();

  const patient = patientQ.data?.patient;
  const encounters = (encountersQ.data?.data ??
    []) as unknown as EncounterListItem[];
  const selectedEncounter = selectedEncounterQ.data?.encounter as
    | EncounterFull
    | undefined;
  const recentPrescriptions = (
    (prescriptionsQ.data?.data ?? []) as Array<{
      id: string;
      prescriptionNumber?: string | null;
      status: string;
      createdAt: Date | string;
      items?: ReadonlyArray<unknown>;
      itemCount?: number;
    }>
  ).map((rx) => ({
    id: rx.id,
    prescriptionNumber: rx.prescriptionNumber ?? null,
    status: rx.status,
    createdAt: rx.createdAt,
    items: rx.items ?? Array.from({ length: rx.itemCount ?? 0 }),
  }));
  const recentLesions = (lesionsQ.data ?? []) as unknown as Array<{
    id: string;
    bodyRegion: string;
    imageCount: number;
    createdAt: Date | string;
  }>;
  const protocols = (protocolsQ.data?.protocols ?? []) as unknown as Array<{
    id: string;
    name: string;
    status: string;
    sessionsDone: number;
    totalSessions: number;
    expectedEndDate: Date | string | null;
  }>;
  const activeProtocol = protocols.find((p) => p.status === "ativo");
  const providerCrm =
    (sessionUser as { crm?: string | null } | null)?.crm ?? null;

  // Auto-select most recent encounter when none selected
  React.useEffect(() => {
    if (!selectedId && encounters.length > 0) {
      setSelectedId(encounters[0]!.id);
      setMode("view");
    }
  }, [encounters.length, selectedId]);

  // Sync form when entering edit mode
  React.useEffect(() => {
    if (mode === "edit" && selectedEncounter) {
      const dx = selectedEncounter.diagnoses ?? [];
      setForm({
        type: (selectedEncounter.type as RecordType) ?? "clinical",
        chiefComplaint: selectedEncounter.chiefComplaint ?? "",
        subjective: selectedEncounter.subjective ?? "",
        objective: selectedEncounter.objective ?? "",
        assessment: selectedEncounter.assessment ?? "",
        plan: selectedEncounter.plan ?? "",
        internalNotes: selectedEncounter.internalNotes ?? "",
        diagnoses: dx.map((d, i) => ({
          code: d.code,
          description: d.description,
          isPrimary: d.isPrimary ?? i === 0,
        })),
        vitals: {
          bloodPressureSys:
            selectedEncounter.vitalSigns?.bloodPressureSys ?? undefined,
          bloodPressureDia:
            selectedEncounter.vitalSigns?.bloodPressureDia ?? undefined,
          heartRate: selectedEncounter.vitalSigns?.heartRate ?? undefined,
          oxygenSaturation:
            selectedEncounter.vitalSigns?.oxygenSaturation ?? undefined,
          temperatureC: selectedEncounter.vitalSigns?.temperatureC ?? undefined,
          weightKg: selectedEncounter.vitalSigns?.weightKg ?? undefined,
          heightCm: selectedEncounter.vitalSigns?.heightCm ?? undefined,
        },
      });
      setSaveStatus({ kind: "idle" });
    }
  }, [mode, selectedEncounter?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save with debounce
  const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const lastSavedSignatureRef = React.useRef<string>("");

  const persist = React.useCallback(async () => {
    if (!selectedId || mode !== "edit") return;
    if (selectedEncounter && isFinalized(selectedEncounter.status)) return;
    setSaveStatus({ kind: "saving" });
    try {
      const payload = {
        chiefComplaint: form.chiefComplaint || undefined,
        subjective: form.subjective || undefined,
        objective: form.objective || undefined,
        assessment: form.assessment || undefined,
        plan: form.plan || undefined,
        internalNotes: form.internalNotes || undefined,
        diagnoses: form.diagnoses.map((d) => ({
          code: d.code,
          description: d.description,
          isPrimary: d.isPrimary,
          aiGenerated: false,
        })),
        vitalSigns: {
          bloodPressureSys: form.vitals.bloodPressureSys,
          bloodPressureDia: form.vitals.bloodPressureDia,
          heartRate: form.vitals.heartRate,
          oxygenSaturation: form.vitals.oxygenSaturation,
          temperatureC: form.vitals.temperatureC,
          weightKg: form.vitals.weightKg,
          heightCm: form.vitals.heightCm,
        },
      };
      await autoSaveMut.mutateAsync({ id: selectedId, data: payload });
      lastSavedSignatureRef.current = JSON.stringify(form);
      setSaveStatus({ kind: "saved", at: new Date() });
    } catch (err) {
      setSaveStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Falha ao salvar",
      });
    }
  }, [selectedId, mode, selectedEncounter, form, autoSaveMut]);

  // Schedule debounced save on form changes
  React.useEffect(() => {
    if (mode !== "edit") return;
    const sig = JSON.stringify(form);
    if (sig === lastSavedSignatureRef.current) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      void persist();
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [form, mode, persist]);

  // Handlers
  function handleSelectEncounter(id: string) {
    setSelectedId(id);
    setMode("view");
  }

  function handleEdit() {
    setMode("edit");
  }

  function handleCancelEdit() {
    setMode("view");
    setSaveStatus({ kind: "idle" });
  }

  async function handleSaveDraft() {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    await persist();
    void utils.clinical.encounters.getById.invalidate({ id: selectedId ?? "" });
    void utils.clinical.encounters.getByPatient.invalidate({ patientId });
    toast({ variant: "success", title: "Rascunho salvo" });
  }

  function handleOpenFinalize() {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    void persist();
    setFinalizeOpen(true);
  }

  async function handleConfirmFinalize() {
    if (!selectedId) return;
    try {
      await persist();
      await signMut.mutateAsync({ id: selectedId });
      toast({ variant: "success", title: "Prontuário finalizado e assinado" });
      setFinalizeOpen(false);
      void utils.clinical.encounters.getById.invalidate({ id: selectedId });
      void utils.clinical.encounters.getByPatient.invalidate({ patientId });
      setMode("view");
    } catch (err) {
      toast({
        title: "Não foi possível finalizar",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "error",
      });
    }
  }

  async function handleSuggestSoap() {
    if (!form.chiefComplaint.trim()) return;
    try {
      const res = await aiSoapMut.mutateAsync({
        chiefComplaint: form.chiefComplaint,
        patientHistory: [
          patient?.chronicConditions?.length
            ? `Crônicas: ${patient.chronicConditions.join(", ")}`
            : "",
          patient?.activeMedications?.length
            ? `Medicações: ${patient.activeMedications.join(", ")}`
            : "",
        ]
          .filter(Boolean)
          .join(" · "),
      });
      const draft = res.draft;
      setForm((prev) => ({
        ...prev,
        subjective: draft.subjective ?? prev.subjective,
        objective: draft.objective ?? prev.objective,
        assessment: draft.assessment ?? prev.assessment,
        plan: draft.plan ?? prev.plan,
      }));
      toast({
        variant: "info",
        title: "Rascunho SOAP sugerido pela IA",
        description: "Revise cuidadosamente antes de aceitar.",
      });
    } catch (err) {
      toast({
        title: "Assistente indisponível",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "error",
      });
    }
  }

  async function handleNewRecord() {
    // 1. Reuse an existing draft if any — never create duplicates.
    const draft = encounters.find((e) => e.status === "rascunho");
    if (draft) {
      setSelectedId(draft.id);
      setMode("edit");
      return;
    }

    // 2. Walk-in flow: create a synthetic appointment + encounter atomically.
    //    The user stays on the prontuário tab; no redirect to /agenda.
    if (!sessionUser?.id) {
      toast({
        title: "Sessão não identificada",
        description: "Faça login novamente para iniciar um atendimento.",
        variant: "error",
      });
      return;
    }
    try {
      const appt = await createAppointmentMut.mutateAsync({
        patientId,
        providerId: sessionUser.id,
        type: "walk_in",
        scheduledAt: new Date(),
        durationMin: 30,
        source: "walk_in",
        internalNotes: "Atendimento iniciado direto pelo prontuário (walk-in).",
      });
      const enc = await createEncounterMut.mutateAsync({
        appointmentId: appt.appointment.id,
        type: "clinical",
      });
      void utils.clinical.encounters.getByPatient.invalidate({ patientId });
      setSelectedId(enc.encounter.id);
      setMode("edit");
      toast({
        variant: "success",
        title: "Novo prontuário iniciado",
        description:
          "Rascunho aberto. Preencha e finalize quando estiver pronto.",
      });
    } catch (err) {
      toast({
        title: "Não foi possível iniciar o prontuário",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "error",
      });
    }
  }

  function handleShare(payload: SharePayload) {
    // Backend stub — log to console + audit toast.
    // Real implementation: trpc.clinical.sharing.create({ encounterId, payload }).
    // eslint-disable-next-line no-console
    console.info("[record-share]", { encounterId: selectedId, payload });
    toast({
      variant: "success",
      title: "Compartilhamento registrado",
      description: `Escopo: ${payload.scope} · ${payload.packages.length} item(ns) · ${payload.channels.length} canal(is)`,
    });
    setShareOpen(false);
  }

  function handleOpenShare() {
    if (!selectedEncounter) {
      toast({
        title: "Selecione um prontuário",
        description: "Abra um registro finalizado para compartilhar.",
        variant: "error",
      });
      return;
    }
    if (!isFinalized(selectedEncounter.status)) {
      toast({
        title: "Rascunhos não podem ser compartilhados",
        description:
          "Finalize e assine o prontuário antes de enviar ao paciente ou equipe.",
        variant: "error",
      });
      return;
    }
    setShareOpen(true);
  }

  function handleExportPdf() {
    if (!selectedEncounter) {
      toast({
        title: "Selecione um prontuário",
        description: "Abra um registro para gerar o PDF.",
        variant: "error",
      });
      return;
    }
    toast({
      variant: "info",
      title: "Exportação em PDF",
      description: "Funcionalidade em integração com o gerador de documentos.",
    });
  }

  function handleNewPrescription() {
    router.push(`/pacientes/${patientId}/prescricoes`);
  }

  function handleRequestExam() {
    toast({
      variant: "info",
      title: "Solicitação de exame",
      description:
        "Ponto de integração preparado para gerar pedido a partir do plano.",
    });
  }

  function handleAttachImage() {
    router.push(`/pacientes/${patientId}/imagens`);
  }

  function handlePlanAction(target: string) {
    const routes: Record<string, string> = {
      prescription: `/pacientes/${patientId}/prescricoes`,
      image: `/pacientes/${patientId}/imagens`,
      protocol: `/pacientes/${patientId}/protocolos`,
      appointment: `/pacientes/${patientId}/agendamentos`,
      finance: `/pacientes/${patientId}/financeiro`,
      communication: `/pacientes/${patientId}/comunicacao`,
      supplies: `/pacientes/${patientId}/insumos`,
    };
    const route = routes[target];
    if (route) {
      router.push(route);
      return;
    }
    toast({
      variant: "info",
      title: "Integração preparada",
      description:
        "A ação ficará vinculada ao health record quando o contrato da API estiver disponível.",
    });
  }

  function handleAmend() {
    toast({
      variant: "info",
      title: "Adendo clínico",
      description:
        "Correções em documento finalizado serão registradas como adendo auditável.",
    });
  }

  // Compute warnings for finalize dialog
  const finalizeWarnings = React.useMemo(() => {
    const out: string[] = [];
    if (form.diagnoses.length === 0) out.push("Nenhum CID-10 adicionado.");
    if (!form.subjective.trim()) out.push("Subjetivo (S) sem conteúdo.");
    if (!form.objective.trim()) out.push("Objetivo (O) sem conteúdo.");
    if (!form.assessment.trim()) out.push("Avaliação (A) sem conteúdo.");
    if (!form.plan.trim()) out.push("Plano (P) sem conteúdo.");
    return out;
  }, [form]);

  if (patientQ.isLoading || !patient) {
    return <LoadingShell />;
  }

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        overflow: "hidden",
        minHeight: 0,
        flexDirection: "column",
      }}
    >
      <PatientRecordHeader
        patientId={patientId}
        patient={{
          name: patient.name,
          age: patient.age,
          gender: patient.gender,
          birthDate: patient.birthDate,
          photoUrl: null,
          allergies: patient.allergies,
          activeMedications: patient.activeMedications,
          chronicConditions: patient.chronicConditions,
        }}
        selectedEncounter={selectedEncounter ?? null}
        onBackProfile={() => router.push(`/pacientes/${patientId}/perfil`)}
        onNewRecord={handleNewRecord}
        onNewPrescription={handleNewPrescription}
        onRequestExam={handleRequestExam}
        onAttachImage={handleAttachImage}
        onShare={handleOpenShare}
        onExportPdf={handleExportPdf}
      />

      <div
        style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}
      >
        {!timelineCollapsed && (
          <RecordTimeline
            encounters={encounters}
            selectedId={selectedId}
            onSelect={handleSelectEncounter}
            onCreateNew={handleNewRecord}
            disabled={mode === "edit"}
          />
        )}

        <main
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            minHeight: 0,
          }}
        >
          {(timelineCollapsed || contextCollapsed) && (
            <div
              style={{
                display: "flex",
                gap: 8,
                padding: "8px 22px",
                borderBottom: `1px solid ${T.divider}`,
                background: T.glass,
                flexShrink: 0,
              }}
            >
              {timelineCollapsed && (
                <Btn
                  variant="ghost"
                  small
                  icon="calendar"
                  onClick={() => setTimelineCollapsed(false)}
                >
                  Mostrar linha do tempo
                </Btn>
              )}
              {contextCollapsed && selectedEncounter && (
                <Btn
                  variant="ghost"
                  small
                  icon="activity"
                  onClick={() => setContextCollapsed(false)}
                >
                  Mostrar contexto clínico
                </Btn>
              )}
            </div>
          )}

          <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
            {mode === "empty" || !selectedId ? (
              <EmptyState onCreateNew={handleNewRecord} />
            ) : selectedEncounterQ.isLoading || !selectedEncounter ? (
              <LoadingCenter />
            ) : mode === "view" ? (
              <RecordViewer
                encounter={selectedEncounter}
                onEdit={
                  !isFinalized(selectedEncounter.status)
                    ? handleEdit
                    : undefined
                }
                onShare={handleOpenShare}
                onExportPdf={handleExportPdf}
                onAmend={
                  isFinalized(selectedEncounter.status)
                    ? handleAmend
                    : undefined
                }
              />
            ) : (
              <RecordEditor
                encounter={selectedEncounter}
                form={form}
                onChange={setForm}
                saveStatus={saveStatus}
                onSaveDraft={() => void handleSaveDraft()}
                onFinalize={handleOpenFinalize}
                onCancel={handleCancelEdit}
                onSuggestSoap={() => void handleSuggestSoap()}
                onPlanAction={handlePlanAction}
                isSuggesting={aiSoapMut.isPending}
                isSaving={saveStatus.kind === "saving"}
                isSubmitting={signMut.isPending}
                readOnly={isFinalized(selectedEncounter.status)}
              />
            )}
          </div>
        </main>

        {/* Right column — context (collapsable on narrow viewports) */}
        {!contextCollapsed && (
          <RecordContextPanel
            patientId={patientId}
            encounter={
              selectedEncounter
                ? {
                    id: selectedEncounter.id,
                    status: selectedEncounter.status,
                    appointmentId: selectedEncounter.appointmentId,
                  }
                : null
            }
            patient={{
              allergies: patient.allergies,
              chronicConditions: patient.chronicConditions,
              activeMedications: patient.activeMedications,
            }}
            vitals={selectedEncounter?.vitalSigns ?? null}
            vitalsRecordedAt={selectedEncounter?.vitalSigns?.recordedAt}
            recentPrescriptions={recentPrescriptions}
            recentLesions={recentLesions}
            activeProtocol={activeProtocol}
            financialSummary={financialQ.data ?? null}
          />
        )}
      </div>

      {/* Dialogs */}
      <RecordFinalizeDialog
        open={finalizeOpen}
        onClose={() => setFinalizeOpen(false)}
        onConfirm={() => void handleConfirmFinalize()}
        isSubmitting={signMut.isPending}
        warnings={finalizeWarnings}
        providerName={sessionUser?.name}
        providerCrm={providerCrm}
      />
      <RecordShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        onConfirm={handleShare}
      />
    </div>
  );
}

function EmptyState({ onCreateNew }: { onCreateNew: () => void }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
      }}
    >
      <Glass
        style={{ padding: "36px 40px", maxWidth: 460, textAlign: "center" }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: T.r.xl,
            background: T.clinical.bg,
            border: `1px solid ${T.clinical.color}18`,
            margin: "0 auto 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ico name="file" size={26} color={T.clinical.color} />
        </div>
        <Mono size={9} spacing="1.2px" color={T.clinical.color}>
          PRONTUÁRIO ELETRÔNICO
        </Mono>
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: T.textPrimary,
            margin: "8px 0 6px",
            letterSpacing: "-0.01em",
          }}
        >
          Selecione um prontuário ou crie um novo
        </h2>
        <p
          style={{
            fontSize: 13,
            color: T.textSecondary,
            lineHeight: 1.55,
            margin: "0 0 18px",
          }}
        >
          Use a linha do tempo para abrir um registro existente, ou inicie um
          novo atendimento a partir da agenda, do perfil ou do encontro clínico.
        </p>
        <Btn small icon="plus" onClick={onCreateNew}>
          Novo prontuário
        </Btn>
      </Glass>
    </div>
  );
}

function LoadingShell() {
  return (
    <div style={{ padding: 32 }}>
      <Mono size={9}>CARREGANDO PACIENTE…</Mono>
    </div>
  );
}

function LoadingCenter() {
  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <Mono size={9}>CARREGANDO PRONTUÁRIO…</Mono>
    </div>
  );
}
