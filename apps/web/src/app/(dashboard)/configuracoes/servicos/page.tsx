import { UnderConstruction } from '@/components/under-construction';
import { Button } from '@dermaos/ui';

export default function ServicosPage() {
  return (
    <UnderConstruction
      title="Catálogo de Serviços"
      description="Procedimentos, valores, duração e configurações por serviço"
      actions={<Button size="sm">+ Novo Serviço</Button>}
    />
  );
}
