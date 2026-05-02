'use client';

import * as React from 'react';
import { T } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { PatientHeader }        from './_components/patient-header';
import { PatientContextSidebar } from './_components/patient-context-sidebar';
import { ProntuarioTabs, type ProntuarioTabId } from './_components/prontuario-tabs';
import { TabResumo }        from './_components/tab-resumo';
import { TabConsultas }     from './_components/tab-consultas';
import { TabPrescricoes }   from './_components/tab-prescricoes';
import { TabProcedimentos } from './_components/tab-procedimentos';
import { TabProtocolos }    from './_components/tab-protocolos';
import { TabImagens }       from './_components/tab-imagens';
import { TabDocumentos }    from './_components/tab-documentos';
import { TabTimeline }      from './_components/tab-timeline';
import { useNovaConsulta }  from './_components/use-nova-consulta';
import { NovoDocumentoDialog }       from './_components/novo-documento-dialog';
import { TermoConsentimentoDialog }  from './_components/termo-consentimento-dialog';
import css from './_components/prontuario.module.css';

export default function ProntuarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: patientId } = React.use(params);
  const [tab, setTab] = React.useState<ProntuarioTabId>('resumo');
  const [uploadSignal, setUploadSignal] = React.useState(0);
  const [showNovoDocumento, setShowNovoDocumento] = React.useState(false);
  const [showNovoTermo, setShowNovoTermo] = React.useState(false);
  const { startEncounter, isStarting, hasOpenDraft, openDraftId } =
    useNovaConsulta(patientId);

  const patientQ = trpc.patients.getById.useQuery(
    { id: patientId },
    { staleTime: 60_000 },
  );
  const patientName = patientQ.data?.patient?.name ?? 'Paciente';

  function openExistingDraft() {
    if (openDraftId) {
      location.assign(`/pacientes/${patientId}/prontuario/consulta/${openDraftId}`);
    }
  }

  function handleNovaConsulta() {
    if (hasOpenDraft) {
      openExistingDraft();
    } else {
      void startEncounter();
    }
  }

  function handleOpenEncounter(encounterId: string) {
    location.assign(`/pacientes/${patientId}/prontuario/consulta/${encounterId}`);
  }

  function handleUploadFotos() {
    setTab('imagens');
    setUploadSignal((n) => n + 1);
  }

  function handleNovoDocumento() {
    setTab('documentos');
    setShowNovoDocumento(true);
  }

  function handleNovoTermo() {
    setTab('documentos');
    setShowNovoTermo(true);
  }

  function handleNovaPrescricao() {
    location.assign(`/prescricoes/nova?patientId=${patientId}`);
  }

  function handleNovoProcedimento() {
    setTab('procedimentos');
  }

  function handleNovoProtocolo() {
    setTab('protocolos');
  }

  return (
    <div className={css.shell} style={{ background: T.bg }}>
      {/* Fixed patient header */}
      <div className={css.header}>
        <PatientHeader
          patientId={patientId}
          onNovaConsulta={handleNovaConsulta}
          onContinuarAtendimento={openExistingDraft}
          hasOpenDraft={hasOpenDraft}
          isStarting={isStarting}
          onUploadFotos={handleUploadFotos}
          onNovoDocumento={handleNovoDocumento}
        />
      </div>

      {/* Body: sidebar + main */}
      <div className={css.body}>
        {/* Context sidebar */}
        <aside className={css.sidebar}>
          <PatientContextSidebar patientId={patientId} />
        </aside>

        {/* Main: tabs + content */}
        <div className={css.main}>
          <div className="print-hide">
            <ProntuarioTabs value={tab} onChange={setTab} />
          </div>

          <div className={css.content}>
            {tab === 'resumo'        && <TabResumo        patientId={patientId} onOpenEncounter={handleOpenEncounter} onNovaConsulta={handleNovaConsulta} />}
            {tab === 'consultas'     && <TabConsultas     patientId={patientId} onNovaConsulta={handleNovaConsulta} />}
            {tab === 'prescricoes'   && <TabPrescricoes   patientId={patientId} onNovaPrescrição={handleNovaPrescricao} />}
            {tab === 'procedimentos' && <TabProcedimentos patientId={patientId} patientName={patientName} />}
            {tab === 'protocolos'    && <TabProtocolos    patientId={patientId} patientName={patientName} />}
            {tab === 'imagens'       && <TabImagens       patientId={patientId} uploadSignal={uploadSignal} />}
            {tab === 'documentos'    && <TabDocumentos    patientId={patientId} onNovoDocumento={handleNovoDocumento} onNovoTermo={handleNovoTermo} />}
            {tab === 'timeline'      && <TabTimeline      patientId={patientId} />}
          </div>
        </div>
      </div>

      {/* Document dialogs */}
      {showNovoDocumento && (
        <NovoDocumentoDialog
          patientId={patientId}
          patientName={patientName}
          onClose={() => setShowNovoDocumento(false)}
        />
      )}
      {showNovoTermo && (
        <TermoConsentimentoDialog
          patientId={patientId}
          patientName={patientName}
          onClose={() => setShowNovoTermo(false)}
        />
      )}
    </div>
  );
}
