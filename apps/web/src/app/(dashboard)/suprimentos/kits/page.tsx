import { UnderConstruction } from '@/components/under-construction';
import { Button } from '@dermaos/ui';

export default function KitsPage() {
  return (
    <UnderConstruction
      title="Kits de Procedimento"
      description="Kits de insumos pré-configurados por tipo de procedimento"
      actions={<Button size="sm">+ Novo Kit</Button>}
    />
  );
}
