import { UnderConstruction } from '@/components/under-construction';
import { Button } from '@dermaos/ui';

export default function FinanceiroCaixaPage() {
  return (
    <UnderConstruction
      title="Caixa do Dia"
      description="Movimentação financeira do dia, fechamento e conciliação bancária"
      actions={
        <>
          <Button variant="outline" size="sm">Exportar</Button>
          <Button size="sm">+ Lançamento</Button>
        </>
      }
    />
  );
}
