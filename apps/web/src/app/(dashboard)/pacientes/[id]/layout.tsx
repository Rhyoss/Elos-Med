/**
 * Layout de paciente individual.
 *
 * Delega guarda de rota ao PatientGuard (client component) que:
 *  - valida UUID antes de chamar a API
 *  - mostra skeleton enquanto carrega
 *  - exibe NotFound clínico com CTA se paciente não existir
 *  - redireciona para /unauthorized se sem permissão
 *  - NUNCA renderiza prontuário com patientId inválido ou ausente
 */

import type { ReactNode } from 'react';
import { PatientGuard } from './_components/patient-guard';

interface Props {
  children: ReactNode;
  params:   Promise<{ id: string }>;
}

export default async function PatientLayout({ children, params }: Props) {
  const { id: patientId } = await params;

  return (
    <PatientGuard patientId={patientId}>
      {children}
    </PatientGuard>
  );
}
