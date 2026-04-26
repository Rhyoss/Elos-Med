import { UnderConstruction } from '@/components/under-construction';
import { Button } from '@dermaos/ui';

export default function ProntuarioPage() {
  return (
    <UnderConstruction
      title="Prontuário"
      description="Timeline de encounters SOAP, prescrições e evoluções clínicas"
      actions={<Button size="sm">Novo Registro</Button>}
    />
  );
}
