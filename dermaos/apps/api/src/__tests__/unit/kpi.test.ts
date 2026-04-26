import { describe, it, expect } from 'vitest';
import {
  calcIMC,
  calcDiasCobertura,
  calcTaxaNoShow,
  calcOcupacao,
  calcTicketMedio,
  KpiValidationError,
} from '../../lib/kpi.js';

describe('calcIMC', () => {
  it('deve calcular IMC corretamente para valores normais', () => {
    // Arrange: 70kg / (1.75m)² = 22.86
    const result = calcIMC(70, 1.75);
    expect(result).toBeCloseTo(22.86, 1);
  });

  it('deve lançar KpiValidationError para altura zero (divisão por zero)', () => {
    expect(() => calcIMC(70, 0)).toThrow(KpiValidationError);
    expect(() => calcIMC(70, 0)).toThrow(/altura/i);
  });

  it('deve lançar KpiValidationError para altura negativa', () => {
    expect(() => calcIMC(70, -1.75)).toThrow(KpiValidationError);
  });

  it('deve lançar KpiValidationError para peso zero', () => {
    expect(() => calcIMC(0, 1.75)).toThrow(KpiValidationError);
  });

  it('deve lançar KpiValidationError para peso negativo', () => {
    expect(() => calcIMC(-70, 1.75)).toThrow(KpiValidationError);
  });

  it('deve classificar como obesidade para IMC > 30', () => {
    const imc = calcIMC(100, 1.70);
    expect(imc).toBeGreaterThan(30);
  });
});

describe('calcDiasCobertura', () => {
  it('deve calcular dias de cobertura corretamente', () => {
    const result = calcDiasCobertura(100, 5);
    expect(result.dias).toBe(20);
    expect(result.historicoInsuficiente).toBe(false);
  });

  it('deve retornar null quando consumo médio é zero (evita Infinity)', () => {
    const result = calcDiasCobertura(100, 0);
    expect(result.dias).toBeNull();
    expect(result.historicoInsuficiente).toBe(false);
  });

  it('deve retornar null com flag quando histórico é insuficiente', () => {
    const result = calcDiasCobertura(50, 2, { historicoInsuficiente: true });
    expect(result.dias).toBeNull();
    expect(result.historicoInsuficiente).toBe(true);
  });

  it('deve calcular zero dias quando estoque é zero', () => {
    const result = calcDiasCobertura(0, 5);
    expect(result.dias).toBe(0);
  });
});

describe('calcTaxaNoShow', () => {
  it('deve calcular taxa de no-show corretamente', () => {
    expect(calcTaxaNoShow(5, 20)).toBe(0.25); // 25%
  });

  it('deve retornar null quando total de agendamentos é zero (evita 0/0)', () => {
    expect(calcTaxaNoShow(0, 0)).toBeNull();
  });

  it('deve retornar zero quando não há no-shows', () => {
    expect(calcTaxaNoShow(0, 10)).toBe(0);
  });

  it('deve retornar 1 quando todos faltaram', () => {
    expect(calcTaxaNoShow(10, 10)).toBe(1);
  });
});

describe('calcOcupacao', () => {
  it('deve calcular taxa de ocupação corretamente', () => {
    expect(calcOcupacao(8, 10)).toBe(0.8); // 80%
  });

  it('deve retornar null quando total de slots é zero', () => {
    expect(calcOcupacao(0, 0)).toBeNull();
  });

  it('deve retornar zero quando nenhum slot ocupado', () => {
    expect(calcOcupacao(0, 10)).toBe(0);
  });

  it('deve retornar 1 quando 100% ocupado', () => {
    expect(calcOcupacao(10, 10)).toBe(1);
  });
});

describe('calcTicketMedio', () => {
  it('deve calcular ticket médio corretamente', () => {
    expect(calcTicketMedio(3000, 10)).toBe(300);
  });

  it('deve retornar null quando número de consultas é zero', () => {
    expect(calcTicketMedio(0, 0)).toBeNull();
  });

  it('deve retornar null mesmo com receita positiva e zero consultas', () => {
    expect(calcTicketMedio(1000, 0)).toBeNull();
  });

  it('deve calcular ticket médio fracionado corretamente', () => {
    expect(calcTicketMedio(1000, 3)).toBeCloseTo(333.33, 1);
  });
});
