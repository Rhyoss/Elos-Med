"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePasswordSchema = exports.refreshTokenSchema = exports.loginSchema = exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
exports.registerSchema = zod_1.z.object({
    name: zod_1.z
        .string({ required_error: 'Nome é obrigatório' })
        .min(2, 'Nome deve ter no mínimo 2 caracteres')
        .max(255)
        .trim(),
    email: zod_1.z.string({ required_error: 'Email é obrigatório' }).email('Email inválido').toLowerCase().trim(),
    password: zod_1.z
        .string()
        .min(8, 'Senha deve ter no mínimo 8 caracteres')
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Senha deve conter letras maiúsculas, minúsculas e números'),
    role: zod_1.z.enum(['owner', 'admin', 'dermatologist', 'nurse', 'receptionist', 'financial', 'readonly'], {
        required_error: 'Papel é obrigatório',
    }),
    clinicId: zod_1.z.string().uuid('ID de clínica inválido'),
});
exports.forgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email('Email inválido').toLowerCase().trim(),
});
exports.resetPasswordSchema = zod_1.z
    .object({
    token: zod_1.z.string().min(1),
    newPassword: zod_1.z
        .string()
        .min(8, 'Senha deve ter no mínimo 8 caracteres')
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Senha deve conter letras maiúsculas, minúsculas e números'),
    confirmPassword: zod_1.z.string(),
})
    .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z
        .string({ required_error: 'Email é obrigatório' })
        .email('Email inválido')
        .toLowerCase()
        .trim(),
    password: zod_1.z
        .string({ required_error: 'Senha é obrigatória' })
        .min(8, 'Senha deve ter no mínimo 8 caracteres'),
});
exports.refreshTokenSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(1),
});
exports.changePasswordSchema = zod_1.z
    .object({
    currentPassword: zod_1.z.string().min(8),
    newPassword: zod_1.z
        .string()
        .min(8, 'Nova senha deve ter no mínimo 8 caracteres')
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Senha deve conter letras maiúsculas, minúsculas e números'),
    confirmPassword: zod_1.z.string(),
})
    .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
});
//# sourceMappingURL=auth.schema.js.map