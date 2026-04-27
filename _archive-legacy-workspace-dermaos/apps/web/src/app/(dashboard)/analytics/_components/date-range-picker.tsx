'use client';

import { Button, Input, cn } from '@dermaos/ui';

interface DateRangePickerProps {
  start: string;
  end:   string;
  onStart: (s: string) => void;
  onEnd:   (e: string) => void;
  onPreset: (start: string, end: string) => void;
  className?: string;
}

function formatYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function DateRangePicker({
  start, end, onStart, onEnd, onPreset, className,
}: DateRangePickerProps) {
  function preset(days: number) {
    const e = new Date();
    const s = new Date(e); s.setDate(e.getDate() - days + 1);
    onPreset(formatYMD(s), formatYMD(e));
  }
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div className="flex gap-1" role="group" aria-label="Períodos predefinidos">
        <Button size="sm" variant="outline" onClick={() => preset(7)}>7d</Button>
        <Button size="sm" variant="outline" onClick={() => preset(30)}>30d</Button>
        <Button size="sm" variant="outline" onClick={() => preset(90)}>90d</Button>
        <Button size="sm" variant="outline" onClick={() => preset(365)}>12m</Button>
      </div>
      <Input
        type="date"
        value={start}
        max={end}
        onChange={(e) => onStart(e.target.value)}
        className="h-9 w-auto"
        aria-label="Data inicial"
      />
      <span className="text-sm text-muted-foreground">até</span>
      <Input
        type="date"
        value={end}
        min={start}
        max={formatYMD(new Date())}
        onChange={(e) => onEnd(e.target.value)}
        className="h-9 w-auto"
        aria-label="Data final"
      />
    </div>
  );
}
