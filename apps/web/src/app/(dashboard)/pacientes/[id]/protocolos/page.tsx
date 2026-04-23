import { UnderConstruction } from '@/components/under-construction';
import { Button } from '@dermaos/ui';

export default function ProtocolosPage() {
  return (
    <UnderConstruction
      title="Protocolos & Sessões"
      description="Protocolos ativos, sessões realizadas e evolução dos tratamentos"
      actions={<Button size="sm">Novo Protocolo</Button>}
    />
  );
}
