"use strict";
// Funções de validação puras — sem dependências externas
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidCPF = isValidCPF;
exports.normalizeCPF = normalizeCPF;
exports.isValidCNPJ = isValidCNPJ;
exports.normalizePhone = normalizePhone;
exports.normalizeSearchText = normalizeSearchText;
function isValidCPF(cpf) {
    const digits = cpf.replace(/\D/g, '');
    if (digits.length !== 11)
        return false;
    if (/^(\d)\1{10}$/.test(digits))
        return false; // CPFs com todos os dígitos iguais
    const calcDigit = (slice, factor) => {
        const sum = slice
            .split('')
            .reduce((acc, d, i) => acc + parseInt(d, 10) * (factor - i), 0);
        const remainder = sum % 11;
        return remainder < 2 ? 0 : 11 - remainder;
    };
    const first = calcDigit(digits.slice(0, 9), 10);
    const second = calcDigit(digits.slice(0, 10), 11);
    return digits[9] === String(first) && digits[10] === String(second);
}
function normalizeCPF(cpf) {
    return cpf.replace(/\D/g, '');
}
function isValidCNPJ(cnpj) {
    const digits = cnpj.replace(/\D/g, '');
    if (digits.length !== 14)
        return false;
    if (/^(\d)\1{13}$/.test(digits))
        return false;
    const calcDigit = (nums, weights) => {
        const sum = nums.reduce((acc, n, i) => acc + n * (weights[i] ?? 0), 0);
        const remainder = sum % 11;
        return remainder < 2 ? 0 : 11 - remainder;
    };
    const nums = digits.split('').map(Number);
    const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const first = calcDigit(nums.slice(0, 12), w1);
    const second = calcDigit(nums.slice(0, 13), w2);
    return nums[12] === first && nums[13] === second;
}
function normalizePhone(phone) {
    return phone.replace(/\D/g, '');
}
function normalizeSearchText(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}
//# sourceMappingURL=validators.js.map