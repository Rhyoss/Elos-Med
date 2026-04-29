'use client';

import { Glass, Mono, T } from '@dermaos/ui/ds';
import type { AppointmentCardData } from './appointment-detail-sheet';

interface DaySummaryProps {
  appointments: AppointmentCardData[];
  selected:     Date;
}

/**
 * Resumo do dia: contagem agrupada por categoria de procedimento.
 * Fonte de verdade do agrupamento é a string `service.name` ou `type`.
 */
export function DaySummary({ appointments, selected }: DaySummaryProps) {
  const lower = (s: string | null | undefined) => (s ?? '').toLowerCase();

  let consultas = 0;
  let procedimentos = 0;
  let analisesIa = 0;

  for (const a of appointments) {
    const tag = lower(a.service?.name ?? a.type);
    if (tag.includes('botox') || tag.includes('procedimento') || tag.includes('aplica')) {
      procedimentos++;
    } else if (tag.includes('ia') || tag.includes('aurora') || tag.includes('analise')) {
      analisesIa++;
    } else {
      consultas++;
    }
  }

  const rows: Array<{ l: string; v: number; c: string }> = [
    { l: 'Consultas',   v: consultas,     c: T.clinical.color },
    { l: 'Procedim.',   v: procedimentos, c: T.supply.color   },
    { l: 'Análises IA', v: analisesIa,    c: T.aiMod.color    },
  ];

  return (
    <Glass style={{ padding: '10px 12px', borderRadius: T.r.md }}>
      <Mono size={7} spacing="1px" color={T.textMuted}>
        RESUMO DO DIA {selected.getDate()}
      </Mono>
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {rows.map((s) => (
          <div
            key={s.l}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: s.c,
                }}
              />
              <span style={{ fontSize: 11, color: T.textMuted }}>{s.l}</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: T.textPrimary }}>
              {s.v}
            </span>
          </div>
        ))}
      </div>
    </Glass>
  );
}
