import { UnderConstruction } from '@/components/under-construction';
import { Button } from '@dermaos/ui';

export default function AgendamentosPage() {
  return (
    <UnderConstruction
      title="Agendamentos"
      description="Histórico e próximos agendamentos do paciente"
      actions={<Button size="sm">Agendar Consulta</Button>}
    />
  );
}
