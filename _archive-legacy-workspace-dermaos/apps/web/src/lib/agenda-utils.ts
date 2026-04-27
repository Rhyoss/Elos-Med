import { addMinutes as dfAdd, format, isSameDay, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/* ── Status ──────────────────────────────────────────────────────────────── */

export const STATUS_LABEL: Record<string, string> = {
  scheduled:   'Pendente',
  confirmed:   'Confirmado',
  waiting:     'Check-in',
  in_progress: 'Em Atendimento',
  completed:   'Concluído',
  cancelled:   'Cancelado',
  no_show:     'Não Compareceu',
  rescheduled: 'Remarcado',
};

export const STATUS_BORDER: Record<string, string> = {
  scheduled:   'border-l-amber-400',
  confirmed:   'border-l-blue-500',
  waiting:     'border-l-green-300',
  in_progress: 'border-l-green-600',
  completed:   'border-l-slate-400',
  cancelled:   'border-l-red-500',
  no_show:     'border-l-orange-500',
  rescheduled: 'border-l-indigo-400',
};

export const STATUS_BG: Record<string, string> = {
  scheduled:   'bg-amber-50/70',
  confirmed:   'bg-blue-50/70',
  waiting:     'bg-green-50/80',
  in_progress: 'bg-green-100/80',
  completed:   'bg-slate-100/70',
  cancelled:   'bg-red-50/70',
  no_show:     'bg-orange-50/80',
  rescheduled: 'bg-indigo-50/70',
};

/* ── Grid time math ──────────────────────────────────────────────────────── */

export interface AgendaViewConfig {
  startHour:  number;     // 0-23
  endHour:    number;     // exclusive
  slotMin:    number;     // granularidade do grid (ex: 15)
  pxPerSlot:  number;     // altura de uma linha
}

export const DEFAULT_VIEW: AgendaViewConfig = {
  startHour: 7,
  endHour:   21,
  slotMin:   15,
  pxPerSlot: 22,
};

export function totalSlots(cfg: AgendaViewConfig = DEFAULT_VIEW): number {
  return Math.floor(((cfg.endHour - cfg.startHour) * 60) / cfg.slotMin);
}

export function slotLabels(cfg: AgendaViewConfig = DEFAULT_VIEW): Array<{ hhmm: string; isHour: boolean }> {
  const out: Array<{ hhmm: string; isHour: boolean }> = [];
  const total = totalSlots(cfg);
  for (let i = 0; i < total; i++) {
    const min   = cfg.startHour * 60 + i * cfg.slotMin;
    const h     = Math.floor(min / 60);
    const m     = min % 60;
    const hhmm  = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    out.push({ hhmm, isHour: m === 0 });
  }
  return out;
}

export function positionFor(
  date:  Date,
  refDay: Date,
  cfg:   AgendaViewConfig = DEFAULT_VIEW,
): number {
  const start = new Date(refDay);
  start.setHours(cfg.startHour, 0, 0, 0);
  const mins = (date.getTime() - start.getTime()) / 60_000;
  return (mins / cfg.slotMin) * cfg.pxPerSlot;
}

export function heightFor(
  durationMin: number,
  cfg:          AgendaViewConfig = DEFAULT_VIEW,
): number {
  return (durationMin / cfg.slotMin) * cfg.pxPerSlot;
}

export function snapToSlot(
  date: Date,
  cfg:  AgendaViewConfig = DEFAULT_VIEW,
): Date {
  const copy = new Date(date);
  const totalMin = copy.getHours() * 60 + copy.getMinutes();
  const snapped  = Math.round(totalMin / cfg.slotMin) * cfg.slotMin;
  copy.setHours(Math.floor(snapped / 60), snapped % 60, 0, 0);
  return copy;
}

export function formatSlotRange(start: Date, end: Date): string {
  return `${format(start, 'HH:mm')}–${format(end, 'HH:mm')}`;
}

export function formatDateLong(date: Date): string {
  return format(date, "EEEE, dd 'de' MMMM", { locale: ptBR });
}

export function formatDateShort(date: Date): string {
  return format(date, 'dd/MM', { locale: ptBR });
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

export { dfAdd as addMinutes, startOfDay };
