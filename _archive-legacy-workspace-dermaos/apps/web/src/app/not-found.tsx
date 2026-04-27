import Link from 'next/link';
import { Button } from '@dermaos/ui';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-app gap-6 px-4 text-center">
      <span className="text-7xl font-bold text-primary-300" aria-hidden="true">404</span>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">Página não encontrada</h1>
        <p className="text-muted-foreground max-w-md">
          A página que você está procurando não existe ou foi movida.
        </p>
      </div>
      <Link href="/">
        <Button>Voltar ao Início</Button>
      </Link>
    </div>
  );
}
