'use client';

import { Banknote, QrCode, CreditCard, Building2, DollarSign, Loader2 } from 'lucide-react';
import { Card } from '@dermaos/ui';
import { formatBRL } from './format-brl';
import { cn } from '@dermaos/ui';

interface CaixaCardsProps {
  loading:        boolean;
  totalGeral:     number;
  totalPorMetodo: Record<string, number>;
}

const METHOD_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  pix:            { label: 'PIX',        icon: QrCode,    color: 'text-emerald-600' },
  cartao_credito: { label: 'Crédito',    icon: CreditCard, color: 'text-blue-600' },
  cartao_debito:  { label: 'Débito',     icon: CreditCard, color: 'text-indigo-600' },
  dinheiro:       { label: 'Dinheiro',   icon: Banknote,  color: 'text-green-700' },
  plano_saude:    { label: 'Convênio',   icon: Building2, color: 'text-purple-600' },
  boleto:         { label: 'Boleto',     icon: DollarSign, color: 'text-orange-600' },
};

function SkeletonCard() {
  return (
    <Card className="p-4 space-y-2 animate-pulse">
      <div className="h-4 w-20 rounded bg-muted" />
      <div className="h-7 w-32 rounded bg-muted" />
    </Card>
  );
}

export function CaixaCards({ loading, totalGeral, totalPorMetodo }: CaixaCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  // Agrupa cartão crédito + débito em "Cartão"
  const cartao = (totalPorMetodo['cartao_credito'] ?? 0) + (totalPorMetodo['cartao_debito'] ?? 0);

  const methodCards: Array<{ key: string; label: string; icon: React.ElementType; color: string; value: number }> = [
    { key: 'pix',       ...METHOD_CONFIG['pix']!,       value: totalPorMetodo['pix']         ?? 0 },
    { key: 'cartao',    label: 'Cartão', icon: CreditCard, color: 'text-blue-600', value: cartao },
    { key: 'dinheiro',  ...METHOD_CONFIG['dinheiro']!,   value: totalPorMetodo['dinheiro']    ?? 0 },
    { key: 'convenio',  ...METHOD_CONFIG['plano_saude']!, value: totalPorMetodo['plano_saude'] ?? 0 },
    { key: 'boleto',    ...METHOD_CONFIG['boleto']!,     value: totalPorMetodo['boleto']      ?? 0 },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {/* Card Total — destaque visual */}
      <Card className="p-4 lg:col-span-1 bg-primary text-primary-foreground flex flex-col gap-1">
        <span className="text-xs font-medium opacity-80">Total do Dia</span>
        <span className="text-2xl font-bold tabular-nums tracking-tight">
          {formatBRL(totalGeral)}
        </span>
      </Card>

      {methodCards.map(({ key, label, icon: Icon, color, value }) => (
        <Card key={key} className="p-4 flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <Icon className={cn('size-4', color)} aria-hidden="true" />
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
          </div>
          <span className="text-lg font-semibold tabular-nums">
            {formatBRL(value)}
          </span>
        </Card>
      ))}
    </div>
  );
}
