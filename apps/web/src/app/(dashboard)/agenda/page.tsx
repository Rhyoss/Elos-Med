import { UnderConstruction } from '@/components/under-construction';
import { Button } from '@dermaos/ui';
import Link from 'next/link';

export default function AgendaDiaPage() {
  return (
    <UnderConstruction
      title="Agenda — Visão Dia"
      description="Agendamentos do dia com drag-and-drop e status em tempo real"
      actions={
        <>
          <Link href="/agenda/semana"><Button variant="outline" size="sm">Semana</Button></Link>
          <Link href="/agenda/fila"><Button variant="outline" size="sm">Fila de Espera</Button></Link>
          <Button size="sm">+ Novo Agendamento</Button>
        </>
      }
    />
  );
}
