import { UnderConstruction } from '@/components/under-construction';
import { Button } from '@dermaos/ui';

export default function SuprimentosPage() {
  return (
    <UnderConstruction
      title="Posição de Estoque"
      description="Visão geral do inventário com alertas de reposição e validade"
      actions={
        <>
          <Button variant="outline" size="sm">Exportar</Button>
          <Button size="sm">+ Entrada de Estoque</Button>
        </>
      }
    />
  );
}
