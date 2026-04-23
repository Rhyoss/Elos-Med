import { UnderConstruction } from '@/components/under-construction';
import { Button } from '@dermaos/ui';

export default function ConfiguracoesPage() {
  return (
    <UnderConstruction
      title="Dados da Clínica"
      description="Informações cadastrais, logo, endereço e configurações gerais da clínica"
      actions={<Button size="sm">Salvar Alterações</Button>}
    />
  );
}
