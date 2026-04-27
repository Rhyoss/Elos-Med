'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrencyCents } from '../formatters';

interface Point { date: string; value: number | null }

export function RevenueChart({ data }: { data: Point[] }) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-12 text-center">
        Sem dados de receita no período.
      </p>
    );
  }

  const series = data.map((d) => ({
    date:  d.date.slice(5), // MM-DD
    value: d.value ?? 0,
  }));

  return (
    <>
      <div role="img" aria-label="Gráfico de receita diária">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={series} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="date" fontSize={11} tick={{ fill: 'currentColor' }} className="text-muted-foreground" />
            <YAxis
              fontSize={11}
              tick={{ fill: 'currentColor' }}
              className="text-muted-foreground"
              tickFormatter={(v: number) => formatCurrencyCents(v).replace('R$', '').trim()}
            />
            <Tooltip
              formatter={(v: number) => [formatCurrencyCents(v), 'Receita']}
              labelFormatter={(l) => `Dia ${l}`}
              contentStyle={{
                background:  'hsl(var(--popover))',
                border:      '1px solid hsl(var(--border))',
                borderRadius: 6,
                fontSize:    12,
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--primary-500))"
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
              name="Receita"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Receita diária no período</caption>
        <thead>
          <tr><th>Data</th><th>Receita</th></tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{d.date}</td>
              <td>{formatCurrencyCents(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
