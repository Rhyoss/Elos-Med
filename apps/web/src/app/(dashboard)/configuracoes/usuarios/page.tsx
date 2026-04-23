import { UnderConstruction } from '@/components/under-construction';
import { Button } from '@dermaos/ui';

export default function UsuariosPage() {
  return (
    <UnderConstruction
      title="Gestão de Usuários"
      description="Convite, edição de permissões e desativação de usuários da clínica"
      actions={<Button size="sm">+ Convidar Usuário</Button>}
    />
  );
}
