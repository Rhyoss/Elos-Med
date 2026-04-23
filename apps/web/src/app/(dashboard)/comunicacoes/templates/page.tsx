import { UnderConstruction } from '@/components/under-construction';
import { Button } from '@dermaos/ui';

export default function TemplatesPage() {
  return (
    <UnderConstruction
      title="Biblioteca de Templates"
      description="Templates de mensagens para WhatsApp, e-mail e SMS aprovados pela Meta"
      actions={<Button size="sm">+ Novo Template</Button>}
    />
  );
}
