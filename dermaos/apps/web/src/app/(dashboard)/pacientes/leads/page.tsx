import { UnderConstruction } from '@/components/under-construction';
import { Button } from '@dermaos/ui';

export default function LeadsPage() {
  return (
    <UnderConstruction
      title="Pipeline de Leads"
      description="Kanban de prospecção e conversão de novos pacientes"
      actions={<Button size="sm">+ Novo Lead</Button>}
    />
  );
}
