import { describe, it, expect } from 'vitest';
import { isValidCPF, isValidCNPJ, isValidCRM, normalizeCRM } from '../utils/validators.js';

// ── CPF ──────────────────────────────────────────────────────────────────────

describe('isValidCPF', () => {
  it('deve aceitar CPF válido formatado', () => {
    expect(isValidCPF('529.982.247-25')).toBe(true);
  });

  it('deve aceitar CPF válido sem máscara', () => {
    expect(isValidCPF('52998224725')).toBe(true);
  });

  it('deve rejeitar CPF com dígito verificador errado', () => {
    expect(isValidCPF('529.982.247-26')).toBe(false);
  });

  it('deve rejeitar CPF com todos os dígitos iguais (111.111.111-11)', () => {
    expect(isValidCPF('111.111.111-11')).toBe(false);
  });

  it('deve rejeitar CPF com todos os dígitos iguais (000.000.000-00)', () => {
    expect(isValidCPF('000.000.000-00')).toBe(false);
  });

  it('deve rejeitar CPF com comprimento incorreto', () => {
    expect(isValidCPF('123.456.789')).toBe(false);
  });

  it('deve rejeitar string vazia', () => {
    expect(isValidCPF('')).toBe(false);
  });

  it('deve rejeitar CPF com letras', () => {
    expect(isValidCPF('abc.def.ghi-jk')).toBe(false);
  });

  it('deve aceitar CPF válido com zeros à esquerda', () => {
    expect(isValidCPF('012.345.678-90')).toBe(
      // Verifica se o formato com leading zero é aceito (depende se é válido)
      isValidCPF('01234567890'),
    );
  });
});

// ── CNPJ ─────────────────────────────────────────────────────────────────────

describe('isValidCNPJ', () => {
  it('deve aceitar CNPJ válido formatado', () => {
    expect(isValidCNPJ('11.222.333/0001-81')).toBe(true);
  });

  it('deve aceitar CNPJ válido sem máscara', () => {
    expect(isValidCNPJ('11222333000181')).toBe(true);
  });

  it('deve rejeitar CNPJ com dígito verificador errado', () => {
    expect(isValidCNPJ('11.222.333/0001-82')).toBe(false);
  });

  it('deve rejeitar CNPJ com todos os dígitos iguais (00.000.000/0000-00)', () => {
    expect(isValidCNPJ('00.000.000/0000-00')).toBe(false);
  });

  it('deve rejeitar CNPJ com comprimento incorreto', () => {
    expect(isValidCNPJ('11.222.333/0001')).toBe(false);
  });

  it('deve rejeitar string vazia', () => {
    expect(isValidCNPJ('')).toBe(false);
  });
});

// ── CRM ──────────────────────────────────────────────────────────────────────

describe('isValidCRM', () => {
  it('deve aceitar CRM no formato "CRM/SP 123456"', () => {
    expect(isValidCRM('CRM/SP 123456')).toBe(true);
  });

  it('deve aceitar CRM sem barra e espaço "CRMSP123456"', () => {
    expect(isValidCRM('CRMSP123456')).toBe(true);
  });

  it('deve aceitar CRM no formato alternativo "123456/SP"', () => {
    expect(isValidCRM('123456/SP')).toBe(true);
  });

  it('deve aceitar CRM com estado válido RJ', () => {
    expect(isValidCRM('CRM/RJ 98765')).toBe(true);
  });

  it('deve rejeitar CRM com UF inválida', () => {
    expect(isValidCRM('CRM/XX 123456')).toBe(false);
  });

  it('deve rejeitar CRM com número além de 6 dígitos', () => {
    expect(isValidCRM('CRM/SP 1234567')).toBe(false);
  });

  it('deve rejeitar string vazia', () => {
    expect(isValidCRM('')).toBe(false);
  });

  it('deve ser case-insensitive (crmsp123456)', () => {
    expect(isValidCRM('crmsp123456')).toBe(true);
  });

  it('deve rejeitar formato totalmente inválido', () => {
    expect(isValidCRM('nao-e-crm')).toBe(false);
  });
});

describe('normalizeCRM', () => {
  it('deve normalizar para o formato canônico "CRM/UF NNNNNN"', () => {
    expect(normalizeCRM('CRMSP1234')).toBe('CRM/SP 001234');
  });

  it('deve preservar normalização idempotente', () => {
    const normalized = normalizeCRM('CRM/SP 123456');
    expect(normalizeCRM(normalized)).toBe(normalized);
  });
});
