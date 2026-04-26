import { describe, it, expect } from 'vitest';
import { calculateAvailableSlots, type SlotConfig, type ExistingBlock } from '../../lib/slots.js';

// ── Fixtures de configuração ─────────────────────────────────────────────────

const BASE_CONFIG: SlotConfig = {
  slotSizeMin: 30,
  bufferMin:   0,
  workingHours: {
    mon: { start: '08:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
    tue: { start: '08:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
    wed: { start: '08:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
  },
};

// Segunda-feira às 2026-04-27 (passado irrelevante — estamos usando now injetável)
const MONDAY = new Date('2026-04-27T00:00:00.000Z');
// Data de referência "now" = antes do dia de trabalho para não invalidar slots por passado
const PAST_NOW = new Date('2026-01-01T00:00:00.000Z');

function makeAppointment(startIso: string, durationMin: number, status = 'confirmed'): ExistingBlock {
  const start = new Date(startIso);
  const end   = new Date(start.getTime() + durationMin * 60_000);
  return { start, end, status };
}

// ── Testes ───────────────────────────────────────────────────────────────────

describe('calculateAvailableSlots', () => {
  it('deve marcar slot como indisponível quando sobrepõe appointment ativo', () => {
    // Arrange — appointment ocupa 08:00–09:00
    const existing = [makeAppointment('2026-04-27T08:00:00.000Z', 60)];

    // Act
    const slots = calculateAvailableSlots(BASE_CONFIG, MONDAY, 30, existing, PAST_NOW);
    const slot0800 = slots.find((s) => s.start.getUTCHours() === 8 && s.start.getUTCMinutes() === 0);
    const slot0830 = slots.find((s) => s.start.getUTCHours() === 8 && s.start.getUTCMinutes() === 30);

    // Assert
    expect(slot0800?.available).toBe(false);
    expect(slot0830?.available).toBe(false);
  });

  it('deve marcar slot como indisponível quando dentro do break configurado', () => {
    // Act — break configurado 12:00–13:00
    const slots = calculateAvailableSlots(BASE_CONFIG, MONDAY, 30, [], PAST_NOW);
    const slot1200 = slots.find((s) => s.start.getUTCHours() === 12 && s.start.getUTCMinutes() === 0);

    // Assert
    expect(slot1200?.available).toBe(false);
  });

  it('deve marcar slot como indisponível quando fora do horário de funcionamento', () => {
    // Act — horário 07:00 (antes das 08:00)
    const slots = calculateAvailableSlots(BASE_CONFIG, MONDAY, 30, [], PAST_NOW);
    const slot0700 = slots.find((s) => s.start.getUTCHours() === 7);

    // Assert — slots são gerados apenas dentro do expediente
    expect(slot0700).toBeUndefined();
  });

  it('deve retornar array vazio para dia sem expediente configurado', () => {
    // Arrange — sábado (sun) não configurado
    const SATURDAY = new Date('2026-04-25T00:00:00.000Z'); // sábado

    // Act
    const slots = calculateAvailableSlots(BASE_CONFIG, SATURDAY, 30, [], PAST_NOW);

    // Assert
    expect(slots).toHaveLength(0);
  });

  it('deve liberar slot quando appointment tem status cancelled', () => {
    // Arrange — appointment cancelado no slot 08:00
    const existing = [makeAppointment('2026-04-27T08:00:00.000Z', 30, 'cancelled')];

    // Act
    const slots = calculateAvailableSlots(BASE_CONFIG, MONDAY, 30, existing, PAST_NOW);
    const slot0800 = slots.find((s) => s.start.getUTCHours() === 8 && s.start.getUTCMinutes() === 0);

    // Assert — cancelado não bloqueia slot
    expect(slot0800?.available).toBe(true);
  });

  it('deve permitir dois appointments sem sobreposição em slots distintos', () => {
    // Arrange — 08:00–08:30 e 09:00–09:30
    const existing = [
      makeAppointment('2026-04-27T08:00:00.000Z', 30),
      makeAppointment('2026-04-27T09:00:00.000Z', 30),
    ];

    // Act
    const slots = calculateAvailableSlots(BASE_CONFIG, MONDAY, 30, existing, PAST_NOW);
    const slot0830 = slots.find((s) => s.start.getUTCHours() === 8 && s.start.getUTCMinutes() === 30);
    const slot0930 = slots.find((s) => s.start.getUTCHours() === 9 && s.start.getUTCMinutes() === 30);

    // Assert — slots entre os appointments estão livres
    expect(slot0830?.available).toBe(true);
    expect(slot0930?.available).toBe(true);
  });

  it('deve marcar slot como indisponível quando duração > tempo restante até fim do expediente', () => {
    // Arrange — serviço de 60min, expediente termina às 18:00
    // Slot 17:30 + 60min = 18:30 > 18:00 → não deve aparecer
    const slots = calculateAvailableSlots(BASE_CONFIG, MONDAY, 60, [], PAST_NOW);
    const slot1730 = slots.find((s) => s.start.getUTCHours() === 17 && s.start.getUTCMinutes() === 30);

    // Assert — slot 17:30 com duração 60min excede o expediente
    expect(slot1730).toBeUndefined();
  });

  it('deve respeitar buffer entre consultas quando bufferMin > 0', () => {
    // Arrange — appointment 08:00–08:30 com buffer de 15min → bloqueia até 08:45
    const configComBuffer = { ...BASE_CONFIG, bufferMin: 15 };
    const existing = [makeAppointment('2026-04-27T08:00:00.000Z', 30)];

    // Act
    const slots = calculateAvailableSlots(configComBuffer, MONDAY, 30, existing, PAST_NOW);
    const slot0830 = slots.find((s) => s.start.getUTCHours() === 8 && s.start.getUTCMinutes() === 30);

    // Assert — 08:30 bloqueado pelo buffer (appointment termina 08:30, + 15min buffer = 08:45)
    expect(slot0830?.available).toBe(false);
  });
});
