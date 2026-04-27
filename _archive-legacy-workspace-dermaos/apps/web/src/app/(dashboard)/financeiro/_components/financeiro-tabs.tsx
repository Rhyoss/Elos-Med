'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@dermaos/ui';
import { LayoutDashboard, FileText, Target, TrendingUp } from 'lucide-react';

const TABS = [
  { href: '/financeiro',        label: 'Caixa do Dia',  icon: LayoutDashboard },
  { href: '/financeiro/faturas', label: 'Faturas',       icon: FileText },
  { href: '/financeiro/metas',   label: 'Metas',         icon: Target },
  { href: '/financeiro/dre',     label: 'DRE',           icon: TrendingUp },
] as const;

export function FinanceiroTabs() {
  const pathname = usePathname();

  return (
    <nav
      className="flex border-b border-border bg-background px-6 gap-0"
      role="navigation"
      aria-label="Módulo financeiro"
    >
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== '/financeiro' && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'inline-flex items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-medium',
              'border-b-2 -mb-px transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
              active
                ? 'text-foreground border-primary'
                : 'text-muted-foreground border-transparent hover:text-foreground hover:border-border',
            )}
            aria-current={active ? 'page' : undefined}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
