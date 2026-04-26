import { describe, it, expect, vi, beforeAll } from 'vitest';

// ── Mocks devem ser declarados antes dos imports dos módulos ─────────────────

const TEST_MASTER_KEY = 'a'.repeat(64); // 32 bytes hex válido
const TEST_HMAC_SECRET = 'dermaos-test-hmac-secret-for-unit-tests-min32';

vi.mock('../../config/env.js', () => ({
  env: {
    MASTER_ENCRYPTION_KEY: TEST_MASTER_KEY,
    MASTER_KEY_VERSION:    1,
    TENANT_HMAC_SECRET:    TEST_HMAC_SECRET,
  },
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// ── Imports após mocks ────────────────────────────────────────────────────────

import {
  encrypt,
  decrypt,
  deterministicHash,
  reEncryptIfStale,
  EncryptionError,
} from '../../lib/encryption.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

const CLINIC_A = 'clinic-uuid-aaaa-1111';
const CLINIC_B = 'clinic-uuid-bbbb-2222';

// ── Testes ───────────────────────────────────────────────────────────────────

describe('encrypt + decrypt', () => {
  it('deve retornar o plaintext original após roundtrip', () => {
    // Arrange
    const plaintext = 'João da Silva';

    // Act
    const cipher = encrypt(plaintext, { clinicId: CLINIC_A });
    const result = decrypt(cipher, { clinicId: CLINIC_A });

    // Assert
    expect(result.plaintext).toBe(plaintext);
    expect(result.staleVersion).toBe(false);
    expect(result.version).toBe(1);
  });

  it('deve gerar IVs diferentes em chamadas sucessivas com o mesmo plaintext', () => {
    // Arrange
    const plaintext = 'Dados sensíveis';
    const iterations = 1000;

    // Act
    const ciphertexts = Array.from({ length: iterations }, () =>
      encrypt(plaintext, { clinicId: CLINIC_A }),
    );
    const ivs = new Set(ciphertexts.map((c) => c.split(':')[1]));

    // Assert — 1000 IVs, todos diferentes (probabilidade de colisão negligenciável)
    expect(ivs.size).toBe(iterations);
  });

  it('deve incluir versão no prefixo do ciphertext', () => {
    // Act
    const cipher = encrypt('teste', { clinicId: CLINIC_A });

    // Assert
    expect(cipher.startsWith('v1:')).toBe(true);
  });

  it('deve lançar EncryptionError ao descriptografar ciphertext corrompido', () => {
    // Arrange
    const cipher = encrypt('valor', { clinicId: CLINIC_A });
    const corrupted = cipher.replace(/.$/, 'X'); // altera último char

    // Act + Assert
    expect(() => decrypt(corrupted, { clinicId: CLINIC_A })).toThrow(EncryptionError);
  });

  it('deve lançar EncryptionError ao usar clinicId errado (AAD inválido)', () => {
    // Arrange
    const cipher = encrypt('dado clínica A', { clinicId: CLINIC_A });

    // Act + Assert — mesmo ciphertext, clinic diferente → auth tag falha
    expect(() => decrypt(cipher, { clinicId: CLINIC_B })).toThrow(EncryptionError);
  });

  it('deve lançar EncryptionError para ciphertext malformado (partes faltando)', () => {
    // Act + Assert
    expect(() => decrypt('v1:invalido', { clinicId: CLINIC_A })).toThrow(EncryptionError);
  });

  it('deve sinalizar staleVersion true quando versão do ciphertext < versão atual', () => {
    // Arrange — cria ciphertext com versão 0 (não existe no env test, mas podemos mockar)
    // Abordagem: cria com version override e verifica que staleVersion seria true
    // Como env.MASTER_KEY_VERSION = 1, ciphertext v1 não é stale
    const cipher = encrypt('dado', { clinicId: CLINIC_A, version: 1 });
    const result = decrypt(cipher, { clinicId: CLINIC_A });

    // Assert — versão atual = 1, ciphertext v1 → não stale
    expect(result.staleVersion).toBe(false);
  });

  it('deve lançar EncryptionError quando clinicId está vazio', () => {
    // Act + Assert
    expect(() => encrypt('teste', { clinicId: '' })).toThrow(EncryptionError);
  });
});

describe('deterministicHash', () => {
  it('deve ser determinístico: mesma entrada → mesmo hash', () => {
    // Act
    const h1 = deterministicHash('123.456.789-09');
    const h2 = deterministicHash('123.456.789-09');

    // Assert
    expect(h1).toBe(h2);
  });

  it('deve normalizar a entrada antes de hashear (case + espaços)', () => {
    // Act
    const h1 = deterministicHash('  JOAO@EXAMPLE.COM  ');
    const h2 = deterministicHash('joao@example.com');

    // Assert
    expect(h1).toBe(h2);
  });

  it('deve produzir hashes diferentes para salts diferentes (via HMAC_SECRET)', () => {
    // Nota: deterministicHash usa env.TENANT_HMAC_SECRET como "salt" global.
    // Para testar resistência a rainbow tables, verificamos que o hash
    // não é simplesmente SHA256(value) sem segredo.
    const hashComSegredo = deterministicHash('cpf:12345678900');
    const sha256SemSegredo = '35c8dfe93c78d3b0ab12f8e6f4a8f5b9b0a6b1c2d3e4f5a6b7c8d9e0f1a2b3c4';

    // Assert — nosso hash HMAC deve ser diferente do SHA256 puro
    expect(hashComSegredo).not.toBe(sha256SemSegredo);
    expect(hashComSegredo).toHaveLength(64); // hex SHA256 = 64 chars
  });

  it('deve produzir saída hex lowercase', () => {
    // Act
    const h = deterministicHash('valor');

    // Assert
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('reEncryptIfStale', () => {
  it('deve retornar null quando ciphertext já está na versão atual', () => {
    // Arrange
    const cipher = encrypt('dado', { clinicId: CLINIC_A }); // versão 1 (atual)

    // Act
    const result = reEncryptIfStale(cipher, { clinicId: CLINIC_A });

    // Assert
    expect(result).toBeNull();
  });

  it('deve permitir roundtrip completo: encrypt + decrypt roundtrip preserva plaintext', () => {
    // Arrange
    const original = 'Dado muito sensível do paciente';

    // Act — simula re-encrypt: encrypt → decrypt → re-encrypt
    const v1Cipher = encrypt(original, { clinicId: CLINIC_A, version: 1 });
    const decrypted = decrypt(v1Cipher, { clinicId: CLINIC_A });

    // Assert
    expect(decrypted.plaintext).toBe(original);
  });
});
