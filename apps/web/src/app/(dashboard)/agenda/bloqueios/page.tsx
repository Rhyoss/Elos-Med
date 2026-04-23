import { UnderConstruction } from '@/components/under-construction';
import { Button } from '@dermaos/ui';

export default function BloqueiosPage() {
  return (
    <UnderConstruction
      title="Bloqueios & Ausências"
      description="Gerenciamento de horários bloqueados, férias e ausências dos profissionais"
      actions={<Button size="sm">+ Novo Bloqueio</Button>}
    />
  );
}
