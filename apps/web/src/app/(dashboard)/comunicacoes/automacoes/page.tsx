import { UnderConstruction } from '@/components/under-construction';
import { Button } from '@dermaos/ui';

export default function AutomacoesPage() {
  return (
    <UnderConstruction
      title="Automações"
      description="Regras de envio automático de mensagens por gatilhos de evento"
      actions={<Button size="sm">+ Nova Automação</Button>}
    />
  );
}
