import { z } from 'zod';
export declare const INVOICE_STATUSES: readonly ["rascunho", "emitida", "parcial", "paga", "vencida", "cancelada"];
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export declare const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string>;
export declare const PAYMENT_METHODS: readonly ["dinheiro", "pix", "cartao_credito", "cartao_debito", "boleto", "plano_saude"];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export declare const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string>;
export declare const SERVICE_CATEGORIES: readonly ["consulta", "procedimento_estetico", "procedimento_cirurgico", "exame", "produto", "outro"];
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];
export declare const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string>;
export declare const DISCOUNT_REASONS: readonly ["cortesia", "pacote", "fidelidade", "negociacao", "outro"];
export type DiscountReason = (typeof DISCOUNT_REASONS)[number];
export declare const DISCOUNT_REASON_LABELS: Record<DiscountReason, string>;
export declare const createServiceSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    category: z.ZodDefault<z.ZodEnum<["consulta", "procedimento_estetico", "procedimento_cirurgico", "exame", "produto", "outro"]>>;
    tussCode: z.ZodOptional<z.ZodString>;
    cbhpmCode: z.ZodOptional<z.ZodString>;
    price: z.ZodNumber;
    durationMin: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    durationMin: number;
    price: number;
    category: "outro" | "consulta" | "procedimento_estetico" | "procedimento_cirurgico" | "exame" | "produto";
    description?: string | undefined;
    tussCode?: string | undefined;
    cbhpmCode?: string | undefined;
}, {
    name: string;
    price: number;
    durationMin?: number | undefined;
    description?: string | undefined;
    category?: "outro" | "consulta" | "procedimento_estetico" | "procedimento_cirurgico" | "exame" | "produto" | undefined;
    tussCode?: string | undefined;
    cbhpmCode?: string | undefined;
}>;
export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export declare const updateServiceSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    category: z.ZodOptional<z.ZodDefault<z.ZodEnum<["consulta", "procedimento_estetico", "procedimento_cirurgico", "exame", "produto", "outro"]>>>;
    tussCode: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    cbhpmCode: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    price: z.ZodOptional<z.ZodNumber>;
    durationMin: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
} & {
    id: z.ZodString;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name?: string | undefined;
    durationMin?: number | undefined;
    price?: number | undefined;
    description?: string | undefined;
    isActive?: boolean | undefined;
    category?: "outro" | "consulta" | "procedimento_estetico" | "procedimento_cirurgico" | "exame" | "produto" | undefined;
    tussCode?: string | undefined;
    cbhpmCode?: string | undefined;
}, {
    id: string;
    name?: string | undefined;
    durationMin?: number | undefined;
    price?: number | undefined;
    description?: string | undefined;
    isActive?: boolean | undefined;
    category?: "outro" | "consulta" | "procedimento_estetico" | "procedimento_cirurgico" | "exame" | "produto" | undefined;
    tussCode?: string | undefined;
    cbhpmCode?: string | undefined;
}>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export declare const listServicesSchema: z.ZodObject<{
    search: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodEnum<["consulta", "procedimento_estetico", "procedimento_cirurgico", "exame", "produto", "outro"]>>;
    isActive: z.ZodOptional<z.ZodBoolean>;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    search?: string | undefined;
    isActive?: boolean | undefined;
    category?: "outro" | "consulta" | "procedimento_estetico" | "procedimento_cirurgico" | "exame" | "produto" | undefined;
}, {
    search?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    isActive?: boolean | undefined;
    category?: "outro" | "consulta" | "procedimento_estetico" | "procedimento_cirurgico" | "exame" | "produto" | undefined;
}>;
export type ListServicesInput = z.infer<typeof listServicesSchema>;
export declare const invoiceItemSchema: z.ZodObject<{
    serviceId: z.ZodString;
    providerId: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    quantity: z.ZodDefault<z.ZodNumber>;
    unitPrice: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    serviceId: string;
    quantity: number;
    providerId?: string | undefined;
    description?: string | undefined;
    unitPrice?: number | undefined;
}, {
    serviceId: string;
    providerId?: string | undefined;
    description?: string | undefined;
    quantity?: number | undefined;
    unitPrice?: number | undefined;
}>;
export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;
export declare const discountSchema: z.ZodDiscriminatedUnion<"discountType", [z.ZodObject<{
    discountType: z.ZodLiteral<"absolute">;
    discountValue: z.ZodNumber;
    discountReason: z.ZodEnum<["cortesia", "pacote", "fidelidade", "negociacao", "outro"]>;
    discountNote: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    discountType: "absolute";
    discountValue: number;
    discountReason: "outro" | "pacote" | "cortesia" | "fidelidade" | "negociacao";
    discountNote?: string | undefined;
}, {
    discountType: "absolute";
    discountValue: number;
    discountReason: "outro" | "pacote" | "cortesia" | "fidelidade" | "negociacao";
    discountNote?: string | undefined;
}>, z.ZodObject<{
    discountType: z.ZodLiteral<"percentage">;
    discountValue: z.ZodNumber;
    discountReason: z.ZodEnum<["cortesia", "pacote", "fidelidade", "negociacao", "outro"]>;
    discountNote: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    discountType: "percentage";
    discountValue: number;
    discountReason: "outro" | "pacote" | "cortesia" | "fidelidade" | "negociacao";
    discountNote?: string | undefined;
}, {
    discountType: "percentage";
    discountValue: number;
    discountReason: "outro" | "pacote" | "cortesia" | "fidelidade" | "negociacao";
    discountNote?: string | undefined;
}>]>;
export type DiscountInput = z.infer<typeof discountSchema>;
export declare const createInvoiceSchema: z.ZodObject<{
    patientId: z.ZodString;
    appointmentId: z.ZodOptional<z.ZodString>;
    providerId: z.ZodOptional<z.ZodString>;
    dueDate: z.ZodOptional<z.ZodDate>;
    notes: z.ZodOptional<z.ZodString>;
    internalNotes: z.ZodOptional<z.ZodString>;
    items: z.ZodArray<z.ZodObject<{
        serviceId: z.ZodString;
        providerId: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        quantity: z.ZodDefault<z.ZodNumber>;
        unitPrice: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        serviceId: string;
        quantity: number;
        providerId?: string | undefined;
        description?: string | undefined;
        unitPrice?: number | undefined;
    }, {
        serviceId: string;
        providerId?: string | undefined;
        description?: string | undefined;
        quantity?: number | undefined;
        unitPrice?: number | undefined;
    }>, "many">;
    discount: z.ZodOptional<z.ZodDiscriminatedUnion<"discountType", [z.ZodObject<{
        discountType: z.ZodLiteral<"absolute">;
        discountValue: z.ZodNumber;
        discountReason: z.ZodEnum<["cortesia", "pacote", "fidelidade", "negociacao", "outro"]>;
        discountNote: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        discountType: "absolute";
        discountValue: number;
        discountReason: "outro" | "pacote" | "cortesia" | "fidelidade" | "negociacao";
        discountNote?: string | undefined;
    }, {
        discountType: "absolute";
        discountValue: number;
        discountReason: "outro" | "pacote" | "cortesia" | "fidelidade" | "negociacao";
        discountNote?: string | undefined;
    }>, z.ZodObject<{
        discountType: z.ZodLiteral<"percentage">;
        discountValue: z.ZodNumber;
        discountReason: z.ZodEnum<["cortesia", "pacote", "fidelidade", "negociacao", "outro"]>;
        discountNote: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        discountType: "percentage";
        discountValue: number;
        discountReason: "outro" | "pacote" | "cortesia" | "fidelidade" | "negociacao";
        discountNote?: string | undefined;
    }, {
        discountType: "percentage";
        discountValue: number;
        discountReason: "outro" | "pacote" | "cortesia" | "fidelidade" | "negociacao";
        discountNote?: string | undefined;
    }>]>>;
}, "strip", z.ZodTypeAny, {
    patientId: string;
    items: {
        serviceId: string;
        quantity: number;
        providerId?: string | undefined;
        description?: string | undefined;
        unitPrice?: number | undefined;
    }[];
    internalNotes?: string | undefined;
    providerId?: string | undefined;
    notes?: string | undefined;
    appointmentId?: string | undefined;
    dueDate?: Date | undefined;
    discount?: {
        discountType: "absolute";
        discountValue: number;
        discountReason: "outro" | "pacote" | "cortesia" | "fidelidade" | "negociacao";
        discountNote?: string | undefined;
    } | {
        discountType: "percentage";
        discountValue: number;
        discountReason: "outro" | "pacote" | "cortesia" | "fidelidade" | "negociacao";
        discountNote?: string | undefined;
    } | undefined;
}, {
    patientId: string;
    items: {
        serviceId: string;
        providerId?: string | undefined;
        description?: string | undefined;
        quantity?: number | undefined;
        unitPrice?: number | undefined;
    }[];
    internalNotes?: string | undefined;
    providerId?: string | undefined;
    notes?: string | undefined;
    appointmentId?: string | undefined;
    dueDate?: Date | undefined;
    discount?: {
        discountType: "absolute";
        discountValue: number;
        discountReason: "outro" | "pacote" | "cortesia" | "fidelidade" | "negociacao";
        discountNote?: string | undefined;
    } | {
        discountType: "percentage";
        discountValue: number;
        discountReason: "outro" | "pacote" | "cortesia" | "fidelidade" | "negociacao";
        discountNote?: string | undefined;
    } | undefined;
}>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export declare const updateInvoiceDraftSchema: z.ZodObject<{
    id: z.ZodString;
    dueDate: z.ZodOptional<z.ZodDate>;
    notes: z.ZodOptional<z.ZodString>;
    internalNotes: z.ZodOptional<z.ZodString>;
    items: z.ZodOptional<z.ZodArray<z.ZodObject<{
        serviceId: z.ZodString;
        providerId: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        quantity: z.ZodDefault<z.ZodNumber>;
        unitPrice: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        serviceId: string;
        quantity: number;
        providerId?: string | undefined;
        description?: string | undefined;
        unitPrice?: number | undefined;
    }, {
        serviceId: string;
        providerId?: string | undefined;
        description?: string | undefined;
        quantity?: number | undefined;
        unitPrice?: number | undefined;
    }>, "many">>;
    discount: z.ZodNullable<z.ZodOptional<z.ZodDiscriminatedUnion<"discountType", [z.ZodObject<{
        discountType: z.ZodLiteral<"absolute">;
        discountValue: z.ZodNumber;
        discountReason: z.ZodEnum<["cortesia", "pacote", "fidelidade", "negociacao", "outro"]>;
        discountNote: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        discountType: "absolute";
        discountValue: number;
        discountReason: "outro" | "pacote" | "cortesia" | "fidelidade" | "negociacao";
        discountNote?: string | undefined;
    }, {
        discountType: "absolute";
        discountValue: number;
        discountReason: "outro" | "pacote" | "cortesia" | "fidelidade" | "negociacao";
        discountNote?: string | undefined;
    }>, z.ZodObject<{
        discountType: z.ZodLiteral<"percentage">;
        discountValue: z.ZodNumber;
        discountReason: z.ZodEnum<["cortesia", "pacote", "fidelidade", "negociacao", "outro"]>;
        discountNote: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        discountType: "percentage";
        discountValue: number;
        discountReason: "outro" | "pacote" | "cortesia" | "fidelidade" | "negociacao";
        discountNote?: string | undefined;
    }, {
        discountType: "percentage";
        discountValue: number;
        discountReason: "outro" | "pacote" | "cortesia" | "fidelidade" | "negociacao";
        discountNote?: string | undefined;
    }>]>>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    internalNotes?: string | undefined;
    notes?: string | undefined;
    items?: {
        serviceId: string;
        quantity: number;
        providerId?: string | undefined;
        description?: string | undefined;
        unitPrice?: number | undefined;
    }[] | undefined;
    dueDate?: Date | undefined;
    discount?: {
        discountType: "absolute";
        discountValue: number;
        discountReason: "outro" | "pacote" | "cortesia" | "fidelidade" | "negociacao";
        discountNote?: string | undefined;
    } | {
        discountType: "percentage";
        discountValue: number;
        discountReason: "outro" | "pacote" | "cortesia" | "fidelidade" | "negociacao";
        discountNote?: string | undefined;
    } | null | undefined;
}, {
    id: string;
    internalNotes?: string | undefined;
    notes?: string | undefined;
    items?: {
        serviceId: string;
        providerId?: string | undefined;
        description?: string | undefined;
        quantity?: number | undefined;
        unitPrice?: number | undefined;
    }[] | undefined;
    dueDate?: Date | undefined;
    discount?: {
        discountType: "absolute";
        discountValue: number;
        discountReason: "outro" | "pacote" | "cortesia" | "fidelidade" | "negociacao";
        discountNote?: string | undefined;
    } | {
        discountType: "percentage";
        discountValue: number;
        discountReason: "outro" | "pacote" | "cortesia" | "fidelidade" | "negociacao";
        discountNote?: string | undefined;
    } | null | undefined;
}>;
export type UpdateInvoiceDraftInput = z.infer<typeof updateInvoiceDraftSchema>;
export declare const listInvoicesSchema: z.ZodObject<{
    patientId: z.ZodOptional<z.ZodString>;
    providerId: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["rascunho", "emitida", "parcial", "paga", "vencida", "cancelada"]>>;
    dateFrom: z.ZodOptional<z.ZodDate>;
    dateTo: z.ZodOptional<z.ZodDate>;
    search: z.ZodOptional<z.ZodString>;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    status?: "rascunho" | "emitida" | "cancelada" | "parcial" | "paga" | "vencida" | undefined;
    search?: string | undefined;
    patientId?: string | undefined;
    providerId?: string | undefined;
    dateFrom?: Date | undefined;
    dateTo?: Date | undefined;
}, {
    status?: "rascunho" | "emitida" | "cancelada" | "parcial" | "paga" | "vencida" | undefined;
    search?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    patientId?: string | undefined;
    providerId?: string | undefined;
    dateFrom?: Date | undefined;
    dateTo?: Date | undefined;
}>;
export type ListInvoicesInput = z.infer<typeof listInvoicesSchema>;
export declare const emitInvoiceSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const cancelInvoiceSchema: z.ZodObject<{
    id: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    id: string;
}, {
    reason: string;
    id: string;
}>;
export type CancelInvoiceInput = z.infer<typeof cancelInvoiceSchema>;
export declare const applyDiscountSchema: z.ZodObject<{
    invoiceId: z.ZodString;
    discount: z.ZodDiscriminatedUnion<"discountType", [z.ZodObject<{
        discountType: z.ZodLiteral<"absolute">;
        discountValue: z.ZodNumber;
        discountReason: z.ZodEnum<["cortesia", "pacote", "fidelidade", "negociacao", "outro"]>;
        discountNote: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        discountType: "absolute";
        discountValue: number;
        discountReason: "outro" | "pacote" | "cortesia" | "fidelidade" | "negociacao";
        discountNote?: string | undefined;
    }, {
        discountType: "absolute";
        discountValue: number;
        discountReason: "outro" | "pacote" | "cortesia" | "fidelidade" | "negociacao";
        discountNote?: string | undefined;
    }>, z.ZodObject<{
        discountType: z.ZodLiteral<"percentage">;
        discountValue: z.ZodNumber;
        discountReason: z.ZodEnum<["cortesia", "pacote", "fidelidade", "negociacao", "outro"]>;
        discountNote: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        discountType: "percentage";
        discountValue: number;
        discountReason: "outro" | "pacote" | "cortesia" | "fidelidade" | "negociacao";
        discountNote?: string | undefined;
    }, {
        discountType: "percentage";
        discountValue: number;
        discountReason: "outro" | "pacote" | "cortesia" | "fidelidade" | "negociacao";
        discountNote?: string | undefined;
    }>]>;
}, "strip", z.ZodTypeAny, {
    invoiceId: string;
    discount: {
        discountType: "absolute";
        discountValue: number;
        discountReason: "outro" | "pacote" | "cortesia" | "fidelidade" | "negociacao";
        discountNote?: string | undefined;
    } | {
        discountType: "percentage";
        discountValue: number;
        discountReason: "outro" | "pacote" | "cortesia" | "fidelidade" | "negociacao";
        discountNote?: string | undefined;
    };
}, {
    invoiceId: string;
    discount: {
        discountType: "absolute";
        discountValue: number;
        discountReason: "outro" | "pacote" | "cortesia" | "fidelidade" | "negociacao";
        discountNote?: string | undefined;
    } | {
        discountType: "percentage";
        discountValue: number;
        discountReason: "outro" | "pacote" | "cortesia" | "fidelidade" | "negociacao";
        discountNote?: string | undefined;
    };
}>;
export declare const registerPaymentSchema: z.ZodDiscriminatedUnion<"method", [z.ZodObject<{
    invoiceId: z.ZodString;
    amount: z.ZodNumber;
    paidAt: z.ZodOptional<z.ZodDate>;
    notes: z.ZodOptional<z.ZodString>;
} & {
    method: z.ZodLiteral<"dinheiro">;
}, "strip", z.ZodTypeAny, {
    invoiceId: string;
    amount: number;
    method: "dinheiro";
    notes?: string | undefined;
    paidAt?: Date | undefined;
}, {
    invoiceId: string;
    amount: number;
    method: "dinheiro";
    notes?: string | undefined;
    paidAt?: Date | undefined;
}>, z.ZodObject<{
    invoiceId: z.ZodString;
    amount: z.ZodNumber;
    paidAt: z.ZodOptional<z.ZodDate>;
    notes: z.ZodOptional<z.ZodString>;
} & {
    method: z.ZodLiteral<"pix">;
    pixTxid: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    invoiceId: string;
    amount: number;
    method: "pix";
    notes?: string | undefined;
    paidAt?: Date | undefined;
    pixTxid?: string | undefined;
}, {
    invoiceId: string;
    amount: number;
    method: "pix";
    notes?: string | undefined;
    paidAt?: Date | undefined;
    pixTxid?: string | undefined;
}>, z.ZodObject<{
    invoiceId: z.ZodString;
    amount: z.ZodNumber;
    paidAt: z.ZodOptional<z.ZodDate>;
    notes: z.ZodOptional<z.ZodString>;
} & {
    method: z.ZodLiteral<"cartao_credito">;
    cardBrand: z.ZodOptional<z.ZodString>;
    cardLast4: z.ZodOptional<z.ZodString>;
    cardInstallments: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    invoiceId: string;
    amount: number;
    method: "cartao_credito";
    cardInstallments: number;
    notes?: string | undefined;
    paidAt?: Date | undefined;
    cardBrand?: string | undefined;
    cardLast4?: string | undefined;
}, {
    invoiceId: string;
    amount: number;
    method: "cartao_credito";
    notes?: string | undefined;
    paidAt?: Date | undefined;
    cardBrand?: string | undefined;
    cardLast4?: string | undefined;
    cardInstallments?: number | undefined;
}>, z.ZodObject<{
    invoiceId: z.ZodString;
    amount: z.ZodNumber;
    paidAt: z.ZodOptional<z.ZodDate>;
    notes: z.ZodOptional<z.ZodString>;
} & {
    method: z.ZodLiteral<"cartao_debito">;
    cardBrand: z.ZodOptional<z.ZodString>;
    cardLast4: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    invoiceId: string;
    amount: number;
    method: "cartao_debito";
    notes?: string | undefined;
    paidAt?: Date | undefined;
    cardBrand?: string | undefined;
    cardLast4?: string | undefined;
}, {
    invoiceId: string;
    amount: number;
    method: "cartao_debito";
    notes?: string | undefined;
    paidAt?: Date | undefined;
    cardBrand?: string | undefined;
    cardLast4?: string | undefined;
}>, z.ZodObject<{
    invoiceId: z.ZodString;
    amount: z.ZodNumber;
    paidAt: z.ZodOptional<z.ZodDate>;
    notes: z.ZodOptional<z.ZodString>;
} & {
    method: z.ZodLiteral<"boleto">;
    boletoBarcode: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    invoiceId: string;
    amount: number;
    method: "boleto";
    notes?: string | undefined;
    paidAt?: Date | undefined;
    boletoBarcode?: string | undefined;
}, {
    invoiceId: string;
    amount: number;
    method: "boleto";
    notes?: string | undefined;
    paidAt?: Date | undefined;
    boletoBarcode?: string | undefined;
}>, z.ZodObject<{
    invoiceId: z.ZodString;
    amount: z.ZodNumber;
    paidAt: z.ZodOptional<z.ZodDate>;
    notes: z.ZodOptional<z.ZodString>;
} & {
    method: z.ZodLiteral<"plano_saude">;
    convenioName: z.ZodString;
    convenioGuide: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    invoiceId: string;
    amount: number;
    method: "plano_saude";
    convenioName: string;
    notes?: string | undefined;
    paidAt?: Date | undefined;
    convenioGuide?: string | undefined;
}, {
    invoiceId: string;
    amount: number;
    method: "plano_saude";
    convenioName: string;
    notes?: string | undefined;
    paidAt?: Date | undefined;
    convenioGuide?: string | undefined;
}>]>;
export type RegisterPaymentInput = z.infer<typeof registerPaymentSchema>;
export declare const refundPaymentSchema: z.ZodObject<{
    paymentId: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    paymentId: string;
}, {
    reason: string;
    paymentId: string;
}>;
export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>;
export declare const installmentsSchema: z.ZodObject<{
    invoiceId: z.ZodString;
    method: z.ZodEnum<["dinheiro", "pix", "cartao_credito", "cartao_debito", "boleto", "plano_saude"]>;
    installments: z.ZodNumber;
    firstDueDate: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    invoiceId: string;
    method: "dinheiro" | "pix" | "cartao_credito" | "cartao_debito" | "boleto" | "plano_saude";
    installments: number;
    firstDueDate: Date;
}, {
    invoiceId: string;
    method: "dinheiro" | "pix" | "cartao_credito" | "cartao_debito" | "boleto" | "plano_saude";
    installments: number;
    firstDueDate: Date;
}>;
export type InstallmentsInput = z.infer<typeof installmentsSchema>;
export declare const caixaQuerySchema: z.ZodObject<{
    date: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    date?: Date | undefined;
}, {
    date?: Date | undefined;
}>;
export type CaixaQueryInput = z.infer<typeof caixaQuerySchema>;
export declare const updateFinancialConfigSchema: z.ZodObject<{
    timezone: z.ZodOptional<z.ZodString>;
    maxDiscountPct: z.ZodOptional<z.ZodNumber>;
    adminDiscountFloor: z.ZodOptional<z.ZodNumber>;
    maxInstallments: z.ZodOptional<z.ZodNumber>;
    invoicePrefix: z.ZodOptional<z.ZodString>;
    dueDays: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    timezone?: string | undefined;
    maxDiscountPct?: number | undefined;
    adminDiscountFloor?: number | undefined;
    maxInstallments?: number | undefined;
    invoicePrefix?: string | undefined;
    dueDays?: number | undefined;
}, {
    timezone?: string | undefined;
    maxDiscountPct?: number | undefined;
    adminDiscountFloor?: number | undefined;
    maxInstallments?: number | undefined;
    invoicePrefix?: string | undefined;
    dueDays?: number | undefined;
}>;
export type UpdateFinancialConfigInput = z.infer<typeof updateFinancialConfigSchema>;
//# sourceMappingURL=financial.schema.d.ts.map