import { UnderConstruction } from '@/components/under-construction';
import { Button } from '@dermaos/ui';

export default function AuditoriaPage() {
  return (
    <UnderConstruction
      title="Auditoria & Compliance"
      description="Logs de acesso, alterações de dados e relatórios de compliance LGPD/CFM"
      actions={<Button variant="outline" size="sm">Exportar Logs</Button>}
    />
  );
}
