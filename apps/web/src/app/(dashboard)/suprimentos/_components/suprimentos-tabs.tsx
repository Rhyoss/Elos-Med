'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Mono, T } from '@dermaos/ui/ds';

interface TabDef {
  href:  string;
  label: string;
  match: (pathname: string) => boolean;
}

const TABS: TabDef[] = [
  { href: '/suprimentos',                 label: 'Posição de Estoque',   match: (p) => p === '/suprimentos' || p === '/suprimentos/' },
  { href: '/suprimentos/lotes',           label: 'Lotes & Validades',    match: (p) => p.startsWith('/suprimentos/lotes') },
  { href: '/suprimentos/compras',         label: 'Compras',              match: (p) => p.startsWith('/suprimentos/compras') },
  { href: '/suprimentos/recebimento',     label: 'Recebimento',          match: (p) => p.startsWith('/suprimentos/recebimento') },
  { href: '/suprimentos/kits',            label: 'Kits',                 match: (p) => p.startsWith('/suprimentos/kits') },
  { href: '/suprimentos/rastreabilidade', label: 'Rastreabilidade',      match: (p) => p.startsWith('/suprimentos/rastreabilidade') },
];

export function SuprimentosTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação de Suprimentos"
      style={{
        display: 'flex',
        overflowX: 'auto',
        borderBottom: `1px solid ${T.divider}`,
        gap: 4,
      }}
    >
      {TABS.map((tab) => {
        const active = tab.match(pathname ?? '');
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 14px',
              whiteSpace: 'nowrap',
              borderBottom: active ? `2px solid ${T.supply.color}` : '2px solid transparent',
              marginBottom: -1,
              color: active ? T.textPrimary : T.textMuted,
              transition: 'all 0.15s',
              textDecoration: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.color = T.textPrimary;
            }}
            onMouseLeave={(e) => {
              if (!active) e.currentTarget.style.color = T.textMuted;
            }}
          >
            <Mono
              size={10}
              spacing="0.8px"
              color={active ? T.supply.color : 'inherit'}
              weight={active ? 600 : 500}
            >
              {tab.label.toUpperCase()}
            </Mono>
          </Link>
        );
      })}
    </nav>
  );
}
