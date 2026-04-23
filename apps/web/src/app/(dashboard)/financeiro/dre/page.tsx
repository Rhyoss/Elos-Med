import { UnderConstruction } from '@/components/under-construction';
import { Button } from '@dermaos/ui';

export default function DrePage() {
  return (
    <UnderConstruction
      title="DRE Gerencial"
      description="Demonstrativo de resultado do exercício por período e centro de custo"
      actions={<Button variant="outline" size="sm">Exportar PDF</Button>}
    />
  );
}
