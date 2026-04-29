import { z } from 'zod';

// SEC-17 — política de senha mínima reforçada.
// Decisão: 12 caracteres + complexidade + bloqueio de senhas óbvias por
// regex (covers a maioria das listas comuns sem precisar de HIBP). Para
// HIBP k-anonymity em runtime, ver `validatePasswordStrength` no servidor
// (apps/api/src/modules/auth/password-strength.ts) — chamada explicitamente
// em registerUser/changePassword/resetPassword.
const PASSWORD_MIN_LENGTH = 12;

const COMMON_BAD_PATTERNS = [
  /^(.)\1{3,}/,                           // mesma char repetida 4+ vezes
  /^(?:abc|123|qwe|password|senha|admin|dermaos|123456)/i,
  /^(?:[a-z]+|[A-Z]+|[0-9]+)$/,           // só uma classe
];

const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Senha deve ter no mínimo ${PASSWORD_MIN_LENGTH} caracteres`)
  .max(128, 'Senha excede o tamanho máximo (128)')
  .regex(/[a-z]/, 'Inclua ao menos uma letra minúscula')
  .regex(/[A-Z]/, 'Inclua ao menos uma letra maiúscula')
  .regex(/\d/,    'Inclua ao menos um número')
  .regex(/[^A-Za-z0-9]/, 'Inclua ao menos um caractere especial')
  .refine(
    (s) => !COMMON_BAD_PATTERNS.some((re) => re.test(s)),
    'Senha muito previsível — evite sequências, repetições ou termos comuns',
  );

export const registerSchema = z.object({
  name: z
    .string({ required_error: 'Nome é obrigatório' })
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(255)
    .trim(),
  email: z.string({ required_error: 'Email é obrigatório' }).email('Email inválido').toLowerCase().trim(),
  password: passwordSchema,
  role: z.enum(['owner', 'admin', 'dermatologist', 'nurse', 'receptionist', 'financial', 'readonly'], {
    required_error: 'Papel é obrigatório',
  }),
  clinicId: z.string().uuid('ID de clínica inválido'),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido').toLowerCase().trim(),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email é obrigatório' })
    .email('Email inválido')
    .toLowerCase()
    .trim(),
  // Login NÃO valida a complexidade — apenas exige campo presente.
  // A verificação real é pelo hash argon2id (auth.router.login).
  password: z.string({ required_error: 'Senha é obrigatória' }).min(1).max(128),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'A nova senha deve ser diferente da atual',
    path: ['newPassword'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
