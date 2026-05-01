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

export const STATUS_DOT_COLOR: Record<string, string> = {
  scheduled:   '#f59e0b',
  confirmed:   '#3b82f6',
  waiting:     '#86efac',
  in_progress: '#16a34a',
  completed:   '#94a3b8',
  cancelled:   '#ef4444',
  no_show:     '#f97316',
  rescheduled: '#818cf8',
};

/* ── Density ─────────────────────────────────────────────────────────────── */

export type Density = 'compact' | 'default' | 'comfortable';

export interface DensityConfig {
  pxPerSlot: number;
  cardPadY:  number;
  cardPadX:  number;
  fontSize:  number;
  gap:       number;
}

export const DENSITY: Record<Density, DensityConfig> = {
  compact:     { pxPerSlot: 16, cardPadY: 3, cardPadX: 6,  fontSize: 10, gap: 1 },
  default:     { pxPerSlot: 22, cardPadY: 6, cardPadX: 10, fontSize: 12, gap: 2 },
  comfortable: { pxPerSlot: 30, cardPadY: 8, cardPadX: 12, fontSize: 13, gap: 3 },
};

/* ── Grid time math ──────────────────────────────────────────────────────── */

export interface AgendaViewConfig {
  startHour:  number;
  endHour:    number;
  slotMin:    number;
  pxPerSlot:  number;
}

export const DEFAULT_VIEW: AgendaViewConfig = {
  startHour: 7,
  endHour:   21,
  slotMin:   15,
  pxPerSlot: 22,
};

export function viewConfigFor(density: Density): AgendaViewConfig {
  return { ...DEFAULT_VIEW, pxPerSlot: DENSITY[density].pxPerSlot };
}

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
  date:   Date,
  refDay: Date,
  cfg:    AgendaViewConfig = DEFAULT_VIEW,
): number {
  const start = new Date(refDay);
  start.setHours(cfg.startHour, 0, 0, 0);
  const mins = (date.getTime() - start.getTime()) / 60_000;
  return (mins / cfg.slotMin) * cfg.pxPerSlot;
}

export function heightFor(
  durationMin: number,
  cfg:         AgendaViewConfig = DEFAULT_VIEW,
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

export function dateFromYOffset(
  yPx:    number,
  refDay: Date,
  cfg:    AgendaViewConfig = DEFAULT_VIEW,
): Date {
  const slots = yPx / cfg.pxPerSlot;
  const totalMin = cfg.startHour * 60 + slots * cfg.slotMin;
  const d = new Date(refDay);
  d.setHours(Math.floor(totalMin / 60), Math.round(totalMin % 60), 0, 0);
  return d;
}

/* ── Format helpers ──────────────────────────────────────────────────────── */

export function formatSlotRange(start: Date, end: Date): string {
  return `${format(start, 'HH:mm')}–${format(end, 'HH:mm')}`;
}

export function formatDateLong(date: Date): string {
  return format(date, "EEEE, dd 'de' MMMM", { locale: ptBR });
}

export function formatDateShort(date: Date): string {
  return format(date, 'dd/MM', { locale: ptBR });
}

export function formatTime(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/* ── Week helpers ────────────────────────────────────────────────────────── */

export function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = (day + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function weekDays(weekStart: Date): Date[] {
  const arr: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    arr.push(d);
  }
  return arr;
}

/* ── Module color helper ─────────────────────────────────────────────────── */

export function moduleKeyFor(type: string): 'clinical' | 'aiMod' | 'supply' | 'financial' | 'accentMod' {
  const t = type.toLowerCase();
  if (t.includes('botox') || t.includes('procedimento') || t.includes('aplicac') || t.includes('peel')) return 'supply';
  if (t.includes('ia') || t.includes('aurora') || t.includes('analise')) return 'aiMod';
  return 'clinical';
}

/* ── Next free slot ──────────────────────────────────────────────────────── */

export interface FreeSlot {
  time: string;
  date: Date;
  durationMin: number;
}

export function findNextFreeSlot(
  appointments: Array<{ scheduledAt: Date | string; durationMin?: number }>,
  date: Date,
): FreeSlot | null {
  const now = new Date();
  const sameDay = isSameDay(now, date);
  const startHour = sameDay ? Math.max(7, now.getHours() + 1) : 8;
  for (let h = startHour; h <= 18; h++) {
    const slot = new Date(date);
    slot.setHours(h, 0, 0, 0);
    const conflict = appointments.find((a) => {
      const s = new Date(a.scheduledAt);
      const e = new Date(s.getTime() + (a.durationMin ?? 30) * 60_000);
      return slot >= s && slot < e;
    });
    if (!conflict) {
      return {
        time: `${h.toString().padStart(2, '0')}:00`,
        date: slot,
        durationMin: 60,
      };
    }
  }
  return null;
}

/* ── Delayed appointments ────────────────────────────────────────────────── */

export function isDelayed(scheduledAt: Date | string, status: string): boolean {
  if (status !== 'scheduled' && status !== 'confirmed') return false;
  const s = typeof scheduledAt === 'string' ? new Date(scheduledAt) : scheduledAt;
  return s.getTime() < Date.now();
}

export function delayMinutes(scheduledAt: Date | string): number {
  const s = typeof scheduledAt === 'string' ? new Date(scheduledAt) : scheduledAt;
  return Math.max(0, Math.round((Date.now() - s.getTime()) / 60_000));
}

/* ── Month grid helpers ──────────────────────────────────────────────────── */

export function monthGridDays(year: number, month: number): Array<{ date: Date; outside: boolean }> {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();

  const cells: Array<{ date: Date; outside: boolean }> = [];

  for (let i = 0; i < firstDay; i++) {
    const day = prevDays - firstDay + 1 + i;
    cells.push({ date: new Date(year, month - 1, day), outside: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), outside: false });
  }
  const remaining = 42 - cells.length;
  for (let i = 1; i <= remaining; i++) {
    cells.push({ date: new Date(year, month + 1, i), outside: true });
  }
  return cells;
}

export { dfAdd as addMinutes, startOfDay, isSameDay };
