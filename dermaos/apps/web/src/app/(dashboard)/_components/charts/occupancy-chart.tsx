'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatPercent } from '../formatters';

interface Point {
  providerId:    string;
  providerName:  string;
  occupancyRate: number | null;
}

export function OccupancyChart({ data }: { data: Point[] }) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-12 text-center">
        Sem dados de ocupação no período.
      </p>
    );
  }

  const series = data.map((d) => ({
    name:  d.providerName,
    value: d.occupancyRate ?? 0,
  }));

  return (
    <>
      <div role="img" aria-label="Gráfico de ocupação por profissional">
        <ResponsiveContainer width="100%" height={Math.max(220, data.length * 36)}>
          <BarChart data={series} layout="vertical" margin={{ top: 8, right: 32, left: 16, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              type="number"
              domain={[0, 1]}
              tickFormatter={(v: number) => formatPercent(v, 0)}
              fontSize={11}
              tick={{ fill: 'currentColor' }}
              className="text-muted-foreground"
            />
            <YAxis
              type="category"
              dataKey="name"
              width={140}
              fontSize={11}
              tick={{ fill: 'currentColor' }}
              className="text-muted-foreground"
            />
            <Tooltip
              formatter={(v: number) => [formatPercent(v), 'Ocupação']}
              contentStyle={{
                background:  'hsl(var(--popover))',
                border:      '1px solid hsl(var(--border))',
                borderRadius: 6,
                fontSize:    12,
              }}
            />
            <Bar dataKey="value" fill="hsl(var(--primary-500))" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Taxa de ocupação por profissional</caption>
        <thead>
          <tr><th>Profissional</th><th>Ocupação</th></tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.providerId}>
              <td>{d.providerName}</td>
              <td>{formatPercent(d.occupancyRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
