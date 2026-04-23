import { UnderConstruction } from '@/components/under-construction';
import { Button } from '@dermaos/ui';

export default function ComunicacoesPage() {
  return (
    <UnderConstruction
      title="Inbox Omnichannel"
      description="Central de mensagens — WhatsApp, Instagram, e-mail, SMS e ligações"
      actions={<Button size="sm">Nova Conversa</Button>}
    />
  );
}
