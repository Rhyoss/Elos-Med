import { UnderConstruction } from '@/components/under-construction';
import { Button } from '@dermaos/ui';
import Link from 'next/link';

export default function AnalyticsPage() {
  return (
    <UnderConstruction
      title="Analytics — Visão Geral"
      description="KPIs consolidados da clínica: pacientes, receita, procedimentos e canais"
      actions={
        <>
          <Link href="/analytics/pacientes"><Button variant="outline" size="sm">Jornada</Button></Link>
          <Link href="/analytics/financeiro"><Button variant="outline" size="sm">Financeiro</Button></Link>
          <Button variant="outline" size="sm">Exportar</Button>
        </>
      }
    />
  );
}
