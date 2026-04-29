'use client';

import * as React from 'react';
import { Btn, T } from '@dermaos/ui/ds';
import { ProntuarioSidebar } from './_components/prontuario-sidebar';
import { ProntuarioTabs, type ProntuarioTabId } from './_components/prontuario-tabs';
import { TabResumo }      from './_components/tab-resumo';
import { TabConsultas }   from './_components/tab-consultas';
import { TabPrescricoes } from './_components/tab-prescricoes';
import { TabProtocolos }  from './_components/tab-protocolos';
import { TabImagens }     from './_components/tab-imagens';
import { TabTimeline }    from './_components/tab-timeline';
import { useNovaConsulta } from './_components/use-nova-consulta';
import css from './_components/prontuario.module.css';

export default function ProntuarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: patientId } = React.use(params);
  const [tab, setTab] = React.useState<ProntuarioTabId>('resumo');
  const { startEncounter, isStarting, hasOpenDraft, openDraftId } =
    useNovaConsulta(patientId);

  function handlePrint() {
    // Pequeno delay para garantir que tabs renderizem antes do snapshot.
    requestAnimationFrame(() => window.print());
  }

  function openExistingDraft() {
    if (openDraftId) {
      location.assign(`/pacientes/${patientId}/prontuario/consulta/${openDraftId}`);
    }
  }

  return (
    <div className={css.shell} style={{ background: T.bg }}>
      <ProntuarioSidebar patientId={patientId} />

      <div className={css.main}>
        <div className="print-hide">
          <ProntuarioTabs
            value={tab}
            onChange={setTab}
            trailing={
              <>
                <Btn variant="glass" small icon="printer" onClick={handlePrint}>
                  Imprimir
                </Btn>
                {hasOpenDraft ? (
                  <Btn small icon="edit" onClick={openExistingDraft}>
                    Continuar Atendimento
                  </Btn>
                ) : (
                  <Btn small icon="edit" onClick={startEncounter} disabled={isStarting}>
                    {isStarting ? 'Abrindo…' : 'Nova Consulta'}
                  </Btn>
                )}
              </>
            }
          />
        </div>

        <div className={css.content}>
          {tab === 'resumo'      && <TabResumo      patientId={patientId} onOpenEncounter={(id) => location.assign(`/pacientes/${patientId}/prontuario/consulta/${id}`)} />}
          {tab === 'consultas'   && <TabConsultas   patientId={patientId} />}
          {tab === 'prescricoes' && <TabPrescricoes patientId={patientId} />}
          {tab === 'protocolos'  && <TabProtocolos  patientId={patientId} />}
          {tab === 'imagens'     && <TabImagens     patientId={patientId} />}
          {tab === 'timeline'    && <TabTimeline    patientId={patientId} />}
        </div>
      </div>
    </div>
  );
}
