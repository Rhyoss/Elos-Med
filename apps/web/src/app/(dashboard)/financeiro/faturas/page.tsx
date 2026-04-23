import { UnderConstruction } from '@/components/under-construction';
import { Button } from '@dermaos/ui';

export default function FaturasPage() {
  return (
    <UnderConstruction
      title="Faturas & Cobranças"
      description="Emissão e acompanhamento de faturas, boletos e links de pagamento"
      actions={<Button size="sm">+ Nova Fatura</Button>}
    />
  );
}
