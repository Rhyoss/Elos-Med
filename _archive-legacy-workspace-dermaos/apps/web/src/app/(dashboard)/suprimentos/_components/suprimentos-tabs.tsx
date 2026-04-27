'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@dermaos/ui';

interface TabDef {
  href:  string;
  label: string;
  match: (pathname: string) => boolean;
}

const TABS: TabDef[] = [
  {
    href:  '/suprimentos',
    label: 'Posição de Estoque',
    match: (p) => p === '/suprimentos' || p === '/suprimentos/',
  },
  {
    href:  '/suprimentos/lotes',
    label: 'Lotes & Validades',
    match: (p) => p.startsWith('/suprimentos/lotes'),
  },
  {
    href:  '/suprimentos/compras',
    label: 'Compras',
    match: (p) => p.startsWith('/suprimentos/compras'),
  },
  {
    href:  '/suprimentos/recebimento',
    label: 'Recebimento',
    match: (p) => p.startsWith('/suprimentos/recebimento'),
  },
  {
    href:  '/suprimentos/kits',
    label: 'Kits',
    match: (p) => p.startsWith('/suprimentos/kits'),
  },
  {
    href:  '/suprimentos/rastreabilidade',
    label: 'Rastreabilidade',
    match: (p) => p.startsWith('/suprimentos/rastreabilidade'),
  },
];

export function SuprimentosTabs() {
  const pathname = usePathname();

  return (
    <nav
      className="flex overflow-x-auto border-b border-border scrollbar-none"
      aria-label="Navegação de Suprimentos"
    >
      {TABS.map((tab) => {
        const active = tab.match(pathname ?? '');
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative inline-flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-medium',
              'border-b-2 -mb-px transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
              active
                ? 'text-foreground border-primary'
                : 'text-muted-foreground border-transparent hover:text-foreground hover:border-border',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
