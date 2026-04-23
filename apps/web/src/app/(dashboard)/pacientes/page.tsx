import { PageHeader, EmptyState } from '@dermaos/ui';
import { Button } from '@dermaos/ui';
import Link from 'next/link';

export default function PacientesPage() {
  return (
    <div className="flex flex-col">
      <PageHeader
        title="Pacientes"
        description="Gerencie o cadastro e histórico de todos os pacientes"
        actions={
          <Link href="/pacientes/novo">
            <Button size="sm">+ Novo Paciente</Button>
          </Link>
        }
      />
      <div className="p-6">
        {/* DataTable será implementado no Prompt 06 com tRPC patients.list */}
        <EmptyState
          title="Lista de pacientes"
          description="A tabela de pacientes com busca e filtros será integrada na próxima sprint."
        />
      </div>
    </div>
  );
}
