import { UnderConstruction } from '@/components/under-construction';
import { Button } from '@dermaos/ui';

export default function ComunicacaoPage() {
  return (
    <UnderConstruction
      title="Comunicação"
      description="Histórico de mensagens, e-mails, ligações e automações do paciente"
      actions={<Button size="sm">Enviar Mensagem</Button>}
    />
  );
}
