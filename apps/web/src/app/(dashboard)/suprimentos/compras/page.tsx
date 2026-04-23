import { UnderConstruction } from '@/components/under-construction';
import { Button } from '@dermaos/ui';

export default function ComprasPage() {
  return (
    <UnderConstruction
      title="Pedidos de Compra"
      description="Criação e acompanhamento de ordens de compra com aprovação multi-nível"
      actions={<Button size="sm">+ Nova Ordem</Button>}
    />
  );
}
