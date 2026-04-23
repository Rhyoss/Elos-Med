import { UnderConstruction } from '@/components/under-construction';
import { Button } from '@dermaos/ui';

export default function PerfilPage() {
  return (
    <UnderConstruction
      title="Perfil & Histórico"
      description="Dados cadastrais, contatos, histórico e documentos do paciente"
      actions={<Button size="sm">Editar Perfil</Button>}
    />
  );
}
