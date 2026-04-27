'use client';

import Link from 'next/link';
import { Button } from '@dermaos/ui';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-app gap-6 px-4 text-center">
      <span className="text-7xl font-bold text-warning-500" aria-hidden="true">403</span>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">Acesso negado</h1>
        <p className="text-muted-foreground max-w-md">
          Você não tem permissão para acessar esta página. Se acredita que isso é um erro,
          solicite acesso ao administrador da clínica.
        </p>
      </div>
      <div className="flex gap-3">
        <Link href="/">
          <Button variant="outline">Voltar ao Início</Button>
        </Link>
        <Button
          onClick={() => {
            window.location.href = `mailto:admin@dermaos.com.br?subject=Solicitação de acesso&body=Olá, gostaria de solicitar acesso à página: ${window.location.href}`;
          }}
        >
          Solicitar acesso ao administrador
        </Button>
      </div>
    </div>
  );
}
