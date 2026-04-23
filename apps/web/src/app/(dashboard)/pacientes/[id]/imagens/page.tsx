import { UnderConstruction } from '@/components/under-construction';
import { Button } from '@dermaos/ui';

export default function ImagensPage() {
  return (
    <UnderConstruction
      title="Imagens & Lesões"
      description="Galeria de fotos clínicas, dermoscopia e mapeamento de lesões"
      actions={<Button size="sm">Adicionar Imagem</Button>}
    />
  );
}
