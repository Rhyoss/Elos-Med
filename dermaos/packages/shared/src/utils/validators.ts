// Funções de validação puras — sem dependências externas

export function isValidCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');

  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false; // CPFs com todos os dígitos iguais

  const calcDigit = (slice: string, factor: number): number => {
    const sum = slice
      .split('')
      .reduce((acc, d, i) => acc + parseInt(d, 10) * (factor - i), 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const first  = calcDigit(digits.slice(0, 9), 10);
  const second = calcDigit(digits.slice(0, 10), 11);

  return digits[9] === String(first) && digits[10] === String(second);
}

export function normalizeCPF(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

export function isValidCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '');

  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const calcDigit = (nums: number[], weights: number[]): number => {
    const sum = nums.reduce((acc, n, i) => acc + n * (weights[i] ?? 0), 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const nums   = digits.split('').map(Number);
  const w1     = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2     = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const first  = calcDigit(nums.slice(0, 12), w1);
  const second = calcDigit(nums.slice(0, 13), w2);

  return nums[12] === first && nums[13] === second;
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

const UF_CODES = new Set([
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA',
  'MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN',
  'RO','RR','RS','SC','SE','SP','TO',
]);

/**
 * Valida CRM brasileiro.
 * Formatos aceitos: "CRM/SP 123456", "CRMSP123456", "123456/SP".
 */
export function isValidCRM(crm: string): boolean {
  if (!crm || crm.trim().length === 0) return false;
  const normalized = crm.toUpperCase().replace(/\s+/g, '').replace(/-/g, '');

  // Formato: CRM/UF NNNNNN ou CRMUFNNNNNN
  const match1 = normalized.match(/^CRM\/?([A-Z]{2})\/?(\d{1,6})$/);
  if (match1) {
    return UF_CODES.has(match1[1]!);
  }

  // Formato alternativo: NNNNNN/UF
  const match2 = normalized.match(/^(\d{1,6})\/([A-Z]{2})$/);
  if (match2) {
    return UF_CODES.has(match2[2]!);
  }

  return false;
}

export function normalizeCRM(crm: string): string {
  const upper = crm.toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
  const match1 = upper.match(/^CRM\/?([A-Z]{2})\/?(\d{1,6})$/);
  if (match1) return `CRM/${match1[1]} ${match1[2]!.padStart(6, '0')}`;
  const match2 = upper.match(/^(\d{1,6})\/([A-Z]{2})$/);
  if (match2) return `CRM/${match2[2]} ${match2[1]!.padStart(6, '0')}`;
  return crm;
}
