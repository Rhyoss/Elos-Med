/**
 * Cálculo puro de slots disponíveis — sem dependência de banco.
 * Extraído de scheduling.service.ts para permitir testes unitários.
 */

export type DayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export interface WorkingBreak {
  start: string; // 'HH:mm'
  end: string;
}

export interface WorkingDay {
  start: string; // 'HH:mm'
  end: string;
  breaks?: WorkingBreak[];
}

export interface SlotConfig {
  slotSizeMin: number;
  bufferMin?: number; // buffer após cada consulta — expande o bloqueio de appointments
  workingHours: Partial<Record<DayKey, WorkingDay>>;
}

export interface ExistingBlock {
  start: Date;
  end: Date;
  status?: string; // 'cancelled' → não bloqueia slot
}

export interface SlotWindow {
  start: Date;
  end: Date;
  available: boolean;
}

const DAY_KEYS: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function parseHhmmOn(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  const result = new Date(date);
  result.setHours(h ?? 0, m ?? 0, 0, 0);
  return result;
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export function dayKeyOf(date: Date): DayKey {
  return DAY_KEYS[date.getDay()]!;
}

/**
 * Calcula slots disponíveis para um dia e duração específicos.
 *
 * Um slot é INDISPONÍVEL se:
 *  - Sobrepõe appointment ativo (não cancelado), incluindo buffer configurado.
 *  - Sobrepõe break de almoço/pausa configurado.
 *  - Está fora do horário de funcionamento do provider.
 *  - Termina antes de `now` (slot no passado).
 *  - Duração do serviço maior que o tempo restante até o fim do expediente.
 *
 * @param config              Configuração de agenda do provider.
 * @param date                Dia para calcular slots (hora ignorada).
 * @param durationMin         Duração do serviço/consulta em minutos.
 * @param existingAppointments Appointments existentes no dia (já fetchados do banco).
 * @param now                 Momento atual (default: new Date()). Injetável para testes.
 */
export function calculateAvailableSlots(
  config: SlotConfig,
  date: Date,
  durationMin: number,
  existingAppointments: ExistingBlock[],
  now: Date = new Date(),
): SlotWindow[] {
  const dayKey = dayKeyOf(date);
  const day = config.workingHours[dayKey];

  if (!day) return []; // provider não atende neste dia da semana

  const dayStart = parseHhmmOn(date, day.start);
  const dayEnd   = parseHhmmOn(date, day.end);

  const breaks = (day.breaks ?? []).map((b) => ({
    start: parseHhmmOn(date, b.start),
    end:   parseHhmmOn(date, b.end),
  }));

  const bufferMin = config.bufferMin ?? 0;

  // Appointments ativos (não cancelados) com buffer expandido
  const activeBlocks = existingAppointments
    .filter((a) => a.status !== 'cancelled')
    .map((a) => ({
      start: a.start,
      end:   bufferMin > 0 ? addMinutes(a.end, bufferMin) : a.end,
    }));

  const slots: SlotWindow[] = [];
  let cursor = new Date(dayStart);

  while (addMinutes(cursor, durationMin) <= dayEnd) {
    const start = new Date(cursor);
    const end   = addMinutes(cursor, durationMin);

    const inBreak   = breaks.some((b) => rangesOverlap(start, end, b.start, b.end));
    const inBooking = activeBlocks.some((a) => rangesOverlap(start, end, a.start, a.end));
    const inPast    = end <= now;

    slots.push({ start, end, available: !inBreak && !inBooking && !inPast });

    cursor = addMinutes(cursor, config.slotSizeMin);
  }

  return slots;
}
