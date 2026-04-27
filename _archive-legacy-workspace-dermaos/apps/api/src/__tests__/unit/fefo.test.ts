import { describe, it, expect } from 'vitest';
import {
  selectLotFEFO,
  FefoValidationError,
  type LotForFefo,
} from '../../lib/fefo.js';

// ── Factories ────────────────────────────────────────────────────────────────

let lotSeq = 0;
function makeLot(overrides: Partial<LotForFefo> = {}): LotForFefo {
  const seq = ++lotSeq;
  return {
    id:               `lot-${seq}`,
    lot_number:       `LOT${String(seq).padStart(4, '0')}`,
    expiry_date:      '2099-12-31',
    quantity_current: 100,
    status:           'active',
    product_id:       'prod-1',
    ...overrides,
  };
}

const TODAY = new Date('2026-04-25T00:00:00.000Z');

// ── Testes ───────────────────────────────────────────────────────────────────

describe('selectLotFEFO', () => {
  describe('deve selecionar lote único quando qty suficiente', () => {
    it('deve retornar apenas o lote quando ele tem qty suficiente', () => {
      // Arrange
      const lot = makeLot({ quantity_current: 50 });

      // Act
      const result = selectLotFEFO([lot], 30, TODAY);

      // Assert
      expect(result.insufficient_stock).toBe(false);
      expect(result.plan).toHaveLength(1);
      expect(result.plan[0]!.lotId).toBe(lot.id);
      expect(result.plan[0]!.take).toBe(30);
      expect(result.shortage).toBe(0);
    });
  });

  describe('deve respeitar ordem FEFO com múltiplos lotes', () => {
    it('deve selecionar o lote com menor validade primeiro', () => {
      // Arrange
      const later = makeLot({ expiry_date: '2099-06-01', quantity_current: 100 });
      const earlier = makeLot({ expiry_date: '2099-01-01', quantity_current: 100 });

      // Act
      const result = selectLotFEFO([later, earlier], 10, TODAY);

      // Assert
      expect(result.plan[0]!.lotId).toBe(earlier.id);
      expect(result.plan[0]!.take).toBe(10);
    });
  });

  describe('deve combinar múltiplos lotes quando nenhum é suficiente sozinho', () => {
    it('deve distribuir a qty em FEFO order quando um lote não basta', () => {
      // Arrange
      const lot1 = makeLot({ expiry_date: '2099-01-01', quantity_current: 5 });
      const lot2 = makeLot({ expiry_date: '2099-06-01', quantity_current: 10 });

      // Act
      const result = selectLotFEFO([lot1, lot2], 12, TODAY);

      // Assert
      expect(result.insufficient_stock).toBe(false);
      expect(result.plan).toHaveLength(2);
      expect(result.plan[0]!.lotId).toBe(lot1.id);
      expect(result.plan[0]!.take).toBe(5);
      expect(result.plan[1]!.lotId).toBe(lot2.id);
      expect(result.plan[1]!.take).toBe(7);
    });
  });

  describe('deve retornar array vazio para qty zero', () => {
    it('deve retornar plano vazio sem erro quando qty === 0', () => {
      // Arrange
      const lot = makeLot();

      // Act
      const result = selectLotFEFO([lot], 0, TODAY);

      // Assert
      expect(result.plan).toHaveLength(0);
      expect(result.insufficient_stock).toBe(false);
      expect(result.shortage).toBe(0);
      expect(result.qty_requested).toBe(0);
    });
  });

  describe('deve sinalizar estoque insuficiente quando soma < qty solicitada', () => {
    it('deve retornar insufficient_stock true e shortage correto', () => {
      // Arrange
      const lot1 = makeLot({ quantity_current: 3 });
      const lot2 = makeLot({ quantity_current: 4 });

      // Act
      const result = selectLotFEFO([lot1, lot2], 20, TODAY);

      // Assert
      expect(result.insufficient_stock).toBe(true);
      expect(result.shortage).toBe(13); // 20 - 7 = 13
      expect(result.qty_available).toBe(7);
    });
  });

  describe('deve ignorar lotes com status diferente de active', () => {
    it('deve ignorar lotes consumidos, expirados por status ou em quarentena', () => {
      // Arrange
      const consumed   = makeLot({ status: 'consumed',   quantity_current: 50 });
      const quarantine = makeLot({ status: 'quarantined', quantity_current: 50 });
      const active     = makeLot({ status: 'active',     quantity_current: 10 });

      // Act
      const result = selectLotFEFO([consumed, quarantine, active], 10, TODAY);

      // Assert
      expect(result.plan).toHaveLength(1);
      expect(result.plan[0]!.lotId).toBe(active.id);
    });
  });

  describe('deve ignorar lotes com qty_current === 0', () => {
    it('deve pular lotes zerados mesmo com status active', () => {
      // Arrange
      const empty  = makeLot({ quantity_current: 0 });
      const filled = makeLot({ quantity_current: 5 });

      // Act
      const result = selectLotFEFO([empty, filled], 5, TODAY);

      // Assert
      expect(result.plan).toHaveLength(1);
      expect(result.plan[0]!.lotId).toBe(filled.id);
    });
  });

  describe('deve ignorar lotes vencidos', () => {
    it('deve excluir lotes com expiry_date < hoje', () => {
      // Arrange
      const expired = makeLot({ expiry_date: '2026-04-24', quantity_current: 100 });
      const valid   = makeLot({ expiry_date: '2026-04-25', quantity_current: 5 });

      // Act
      const result = selectLotFEFO([expired, valid], 5, TODAY);

      // Assert
      expect(result.plan).toHaveLength(1);
      expect(result.plan[0]!.lotId).toBe(valid.id);
    });
  });

  describe('deve desempatar por lot_number ASC quando mesma validade', () => {
    it('deve usar lot_number como critério de desempate', () => {
      // Arrange
      const sameDate = '2099-06-01';
      const lotB = makeLot({ lot_number: 'LOT-B', expiry_date: sameDate });
      const lotA = makeLot({ lot_number: 'LOT-A', expiry_date: sameDate });

      // Act
      const result = selectLotFEFO([lotB, lotA], 5, TODAY);

      // Assert
      expect(result.plan[0]!.lotNumber).toBe('LOT-A');
    });
  });

  describe('deve sinalizar insufficient_stock quando não há lotes ativos', () => {
    it('deve retornar insufficient_stock true e qty_available 0 sem lotes', () => {
      // Act
      const result = selectLotFEFO([], 10, TODAY);

      // Assert
      expect(result.insufficient_stock).toBe(true);
      expect(result.qty_available).toBe(0);
      expect(result.shortage).toBe(10);
      expect(result.plan).toHaveLength(0);
    });
  });

  describe('deve tratar lotes sem data de vencimento (null)', () => {
    it('deve colocar lotes sem vencimento no final (NULLS LAST)', () => {
      // Arrange
      const noExpiry = makeLot({ expiry_date: null, quantity_current: 50 });
      const hasExpiry = makeLot({ expiry_date: '2099-03-01', quantity_current: 50 });

      // Act
      const result = selectLotFEFO([noExpiry, hasExpiry], 5, TODAY);

      // Assert
      expect(result.plan[0]!.lotId).toBe(hasExpiry.id);
    });
  });

  describe('edge cases de validação', () => {
    it('deve lançar FefoValidationError para qty negativa', () => {
      // Arrange
      const lot = makeLot();

      // Act + Assert
      expect(() => selectLotFEFO([lot], -1, TODAY)).toThrow(FefoValidationError);
      expect(() => selectLotFEFO([lot], -1, TODAY)).toThrow(/negativa/i);
    });

    it('deve retornar insufficient_stock true para product_id inexistente (lista vazia)', () => {
      // Act
      const result = selectLotFEFO([], 5, TODAY);

      // Assert
      expect(result.insufficient_stock).toBe(true);
      expect(result.qty_available).toBe(0);
    });

    it('deve considerar lote com expiry_date === today como válido', () => {
      // Arrange — lote vence hoje (não está vencido ainda)
      const lot = makeLot({ expiry_date: '2026-04-25', quantity_current: 10 });

      // Act
      const result = selectLotFEFO([lot], 10, TODAY);

      // Assert
      expect(result.insufficient_stock).toBe(false);
      expect(result.plan).toHaveLength(1);
    });
  });
});
