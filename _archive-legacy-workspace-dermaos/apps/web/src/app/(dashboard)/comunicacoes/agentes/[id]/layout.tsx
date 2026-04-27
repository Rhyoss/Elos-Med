'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bot, ChevronLeft } from 'lucide-react';
import { Badge, Button, LoadingSkeleton } from '@dermaos/ui';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc-provider';

interface AgentTab {
  label:   string;
  segment: string;
}

const TABS: AgentTab[] = [
  { label: 'Editor',        segment: ''          },
  { label: 'Knowledge',     segment: 'knowledge' },
  { label: 'Escalação',     segment: 'escalacao' },
  { label: 'Métricas',      segment: 'metricas'  },
];

export default function AgentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params:   Promise<{ id: string }>;
}) {
  const { id } = React.use(params);
  const pathname = usePathname();
  const base = `/comunicacoes/agentes/${id}`;

  const { data, isLoading } = trpc.aurora.admin.get.useQuery({ id }, { enabled: !!id });
  const agent = data?.agent;

  function isActive(segment: string) {
    const target = segment ? `${base}/${segment}` : base;
    if (segment === '') {
      return pathname === base;
    }
    return pathname.startsWith(target);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 bg-card border-b border-border">
        <Link href="/comunicacoes/agentes">
          <Button variant="ghost" size="icon" aria-label="Voltar para lista">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>

        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700"
          aria-hidden="true"
        >
          <Bot className="h-5 w-5" />
        </span>

        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          {isLoading ? (
            <>
              <LoadingSkeleton className="h-5 w-48 rounded" />
              <LoadingSkeleton className="h-3.5 w-32 rounded mt-1" />
            </>
          ) : agent ? (
            <>
              <h1 className="text-lg font-semibold text-foreground truncate">
                {agent.name}
              </h1>
              <div className="flex items-center gap-2">
                <Badge
                  variant={agent.isActive ? 'success' : 'neutral'}
                  dot
                  size="sm"
                >
                  {agent.isActive ? 'Ativo' : 'Inativo'}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {agent.model}
                </span>
              </div>
            </>
          ) : (
            <h1 className="text-lg font-semibold text-muted-foreground">Agente não encontrado</h1>
          )}
        </div>
      </div>

      {/* Secondary nav */}
      <nav
        aria-label="Seções do agente"
        className="flex overflow-x-auto border-b border-border bg-card px-6 scrollbar-none"
      >
        {TABS.map((tab) => {
          const href = tab.segment ? `${base}/${tab.segment}` : base;
          const active = isActive(tab.segment);
          return (
            <Link
              key={tab.segment || 'editor'}
              href={href}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 pb-3 pt-3 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
              )}
              aria-current={active ? 'page' : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
