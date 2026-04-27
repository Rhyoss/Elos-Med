import { UnderConstruction } from '@/components/under-construction';
import { Button } from '@dermaos/ui';

export default function AnalyticsFinanceiroPage() {
  return (
    <UnderConstruction
      title="Financeiro Avançado"
      description="Análise de margem por serviço, previsão de receita e cohort financeiro"
      actions={<Button variant="outline" size="sm">Exportar</Button>}
    />
  );
}
