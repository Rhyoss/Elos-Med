'use client';

import { useMemo, useState } from 'react';
import { PageHeader, Tabs } from '@dermaos/ui';
import { usePermission } from '@/lib/auth';
import { DateRangePicker } from './_components/date-range-picker';
import { ExportButton } from './_components/export-button';
import { OverviewTab } from './_components/overview-tab';
import { JourneyTab } from './_components/journey-tab';
import { SupplyTab } from './_components/supply-tab';
import { OmniTab } from './_components/omni-tab';
import { FinancialTab } from './_components/financial-tab';

type TabKey = 'overview' | 'journey' | 'supply' | 'omni' | 'financial';

function formatYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 29);
  return { start: formatYMD(start), end: formatYMD(end) };
}

export default function AnalyticsPage() {
  const initial = useMemo(defaultRange, []);
  const [start, setStart] = useState(initial.start);
  const [end,   setEnd]   = useState(initial.end);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const canExport = usePermission('analytics', 'export');

  const items = [
    { value: 'overview',  label: 'Visão Geral', content: <OverviewTab  start={start} end={end} /> },
    { value: 'journey',   label: 'Jornada',     content: <JourneyTab   start={start} end={end} /> },
    { value: 'supply',    label: 'Insumos',     content: <SupplyTab    start={start} end={end} /> },
    { value: 'omni',      label: 'Omni',        content: <OmniTab      start={start} end={end} /> },
    { value: 'financial', label: 'Financeiro',  content: <FinancialTab start={start} end={end} /> },
  ];

  return (
    <div className="flex flex-col">
      <PageHeader
        title="DermaIQ Analytics"
        description="Inteligência da clínica: receita, jornada do paciente, insumos, omni e financeiro."
        actions={
          <>
            <DateRangePicker
              start={start}
              end={end}
              onStart={setStart}
              onEnd={setEnd}
              onPreset={(s, e) => { setStart(s); setEnd(e); }}
            />
            <ExportButton tab={activeTab} start={start} end={end} enabled={canExport} />
          </>
        }
      />

      <div className="px-6 py-4">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabKey)}
          items={items}
        />
      </div>
    </div>
  );
}
