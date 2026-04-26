'use client';

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { apptTypeLabel, formatInt } from '../formatters';

interface Point {
  type:       string;
  count:      number;
  percentage: number;
}

const PALETTE = [
  'hsl(var(--primary-500))',
  'hsl(var(--success-500))',
  'hsl(var(--warning-500))',
  'hsl(var(--danger-500))',
  'hsl(var(--info-500))',
  'hsl(var(--neutral-500))',
];

export function DistributionChart({ data }: { data: Point[] }) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-12 text-center">
        Sem dados de distribuição no período.
      </p>
    );
  }

  return (
    <>
      <div role="img" aria-label="Distribuição de tipos de atendimento">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={data.map((d) => ({ ...d, label: apptTypeLabel(d.type) }))}
              dataKey="count"
              nameKey="label"
              innerRadius={50}
              outerRadius={90}
              paddingAngle={2}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number, _n, p) => [
                `${formatInt(v)} (${p.payload.percentage}%)`,
                p.payload.label ?? p.payload.type,
              ]}
              contentStyle={{
                background:  'hsl(var(--popover))',
                border:      '1px solid hsl(var(--border))',
                borderRadius: 6,
                fontSize:    12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Distribuição de atendimentos por tipo</caption>
        <thead>
          <tr><th>Tipo</th><th>Quantidade</th><th>Percentual</th></tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.type}>
              <td>{apptTypeLabel(d.type)}</td>
              <td>{formatInt(d.count)}</td>
              <td>{d.percentage}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
