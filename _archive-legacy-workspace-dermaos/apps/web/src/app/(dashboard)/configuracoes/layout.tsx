'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const NAV_ITEMS = [
  { href: '/configuracoes',             label: 'Dados da Clínica' },
  { href: '/configuracoes/usuarios',    label: 'Usuários & Permissões' },
  { href: '/configuracoes/servicos',    label: 'Catálogo de Serviços' },
  { href: '/configuracoes/integracoes', label: 'Integrações' },
  { href: '/configuracoes/ia',          label: 'IA & Automações' },
  { href: '/configuracoes/auditoria',   label: 'Auditoria' },
] as const;

export default function ConfiguracoesLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col">
      <div className="border-b bg-background">
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-6 py-0">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/configuracoes'
                ? pathname === '/configuracoes'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <main className="flex-1">{children}</main>
    </div>
  );
}
