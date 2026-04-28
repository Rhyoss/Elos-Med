import { z } from 'zod';
export declare const ORDER_STATUSES: readonly ["rascunho", "pendente_aprovacao", "aprovado", "rejeitado", "devolvido", "enviado", "parcialmente_recebido", "recebido", "cancelado"];
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export declare const ORDER_STATUS_LABELS: Record<OrderStatus, string>;
export declare const ORDER_URGENCIES: readonly ["normal", "urgente", "emergencia"];
export type OrderUrgency = (typeof ORDER_URGENCIES)[number];
export declare const ORDER_URGENCY_LABELS: Record<OrderUrgency, string>;
export declare const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]>;
export declare const EDITABLE_STATUSES: ReadonlyArray<OrderStatus>;
declare const orderItemInputSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    productId: z.ZodString;
    quantity: z.ZodNumber;
    estimatedCost: z.ZodNumber;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    quantity: number;
    productId: string;
    estimatedCost: number;
    notes?: string | null | undefined;
    id?: string | undefined;
}, {
    quantity: number;
    productId: string;
    estimatedCost: number;
    notes?: string | null | undefined;
    id?: string | undefined;
}>;
export type OrderItemInput = z.infer<typeof orderItemInputSchema>;
export declare const createPurchaseOrderSchema: z.ZodObject<{
    supplierId: z.ZodString;
    urgency: z.ZodEnum<["normal", "urgente", "emergencia"]>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    expectedDelivery: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        productId: z.ZodString;
        quantity: z.ZodNumber;
        estimatedCost: z.ZodNumber;
        notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        quantity: number;
        productId: string;
        estimatedCost: number;
        notes?: string | null | undefined;
        id?: string | undefined;
    }, {
        quantity: number;
        productId: string;
        estimatedCost: number;
        notes?: string | null | undefined;
        id?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    items: {
        quantity: number;
        productId: string;
        estimatedCost: number;
        notes?: string | null | undefined;
        id?: string | undefined;
    }[];
    supplierId: string;
    urgency: "normal" | "emergencia" | "urgente";
    notes?: string | null | undefined;
    expectedDelivery?: string | null | undefined;
}, {
    items: {
        quantity: number;
        productId: string;
        estimatedCost: number;
        notes?: string | null | undefined;
        id?: string | undefined;
    }[];
    supplierId: string;
    urgency: "normal" | "emergencia" | "urgente";
    notes?: string | null | undefined;
    expectedDelivery?: string | null | undefined;
}>;
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export declare const updatePurchaseOrderSchema: z.ZodObject<{
    orderId: z.ZodString;
    supplierId: z.ZodOptional<z.ZodString>;
    urgency: z.ZodOptional<z.ZodEnum<["normal", "urgente", "emergencia"]>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    expectedDelivery: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    items: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        productId: z.ZodString;
        quantity: z.ZodNumber;
        estimatedCost: z.ZodNumber;
        notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        quantity: number;
        productId: string;
        estimatedCost: number;
        notes?: string | null | undefined;
        id?: string | undefined;
    }, {
        quantity: number;
        productId: string;
        estimatedCost: number;
        notes?: string | null | undefined;
        id?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    orderId: string;
    notes?: string | null | undefined;
    items?: {
        quantity: number;
        productId: string;
        estimatedCost: number;
        notes?: string | null | undefined;
        id?: string | undefined;
    }[] | undefined;
    supplierId?: string | undefined;
    urgency?: "normal" | "emergencia" | "urgente" | undefined;
    expectedDelivery?: string | null | undefined;
}, {
    orderId: string;
    notes?: string | null | undefined;
    items?: {
        quantity: number;
        productId: string;
        estimatedCost: number;
        notes?: string | null | undefined;
        id?: string | undefined;
    }[] | undefined;
    supplierId?: string | undefined;
    urgency?: "normal" | "emergencia" | "urgente" | undefined;
    expectedDelivery?: string | null | undefined;
}>;
export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderSchema>;
export declare const submitOrderSchema: z.ZodObject<{
    orderId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    orderId: string;
}, {
    orderId: string;
}>;
export type SubmitOrderInput = z.infer<typeof submitOrderSchema>;
export declare const approveOrderSchema: z.ZodObject<{
    orderId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    orderId: string;
}, {
    orderId: string;
}>;
export type ApproveOrderInput = z.infer<typeof approveOrderSchema>;
export declare const rejectOrderSchema: z.ZodObject<{
    orderId: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    orderId: string;
}, {
    reason: string;
    orderId: string;
}>;
export type RejectOrderInput = z.infer<typeof rejectOrderSchema>;
export declare const returnOrderSchema: z.ZodObject<{
    orderId: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    orderId: string;
}, {
    reason: string;
    orderId: string;
}>;
export type ReturnOrderInput = z.infer<typeof returnOrderSchema>;
export declare const sendOrderSchema: z.ZodObject<{
    orderId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    orderId: string;
}, {
    orderId: string;
}>;
export type SendOrderInput = z.infer<typeof sendOrderSchema>;
declare const receiveItemSchema: z.ZodObject<{
    purchaseOrderItemId: z.ZodString;
    quantityReceived: z.ZodNumber;
    lotNumber: z.ZodString;
    expiryDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    temperatureCelsius: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    storageLocationId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    lotNumber: string;
    purchaseOrderItemId: string;
    quantityReceived: number;
    storageLocationId?: string | null | undefined;
    expiryDate?: string | null | undefined;
    temperatureCelsius?: number | null | undefined;
}, {
    lotNumber: string;
    purchaseOrderItemId: string;
    quantityReceived: number;
    storageLocationId?: string | null | undefined;
    expiryDate?: string | null | undefined;
    temperatureCelsius?: number | null | undefined;
}>;
export type ReceiveItemInput = z.infer<typeof receiveItemSchema>;
export declare const receiveOrderSchema: z.ZodEffects<z.ZodObject<{
    orderId: z.ZodString;
    type: z.ZodEnum<["confirmar_total", "confirmar_parcial", "recusar"]>;
    nfeXml: z.ZodOptional<z.ZodString>;
    nfeNumber: z.ZodOptional<z.ZodString>;
    nfeSeries: z.ZodOptional<z.ZodString>;
    issuerCnpj: z.ZodOptional<z.ZodString>;
    issueDate: z.ZodOptional<z.ZodString>;
    divergenceJustification: z.ZodOptional<z.ZodString>;
    supervisorApproved: z.ZodOptional<z.ZodBoolean>;
    refusalReason: z.ZodOptional<z.ZodString>;
    items: z.ZodArray<z.ZodObject<{
        purchaseOrderItemId: z.ZodString;
        quantityReceived: z.ZodNumber;
        lotNumber: z.ZodString;
        expiryDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        temperatureCelsius: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        storageLocationId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        lotNumber: string;
        purchaseOrderItemId: string;
        quantityReceived: number;
        storageLocationId?: string | null | undefined;
        expiryDate?: string | null | undefined;
        temperatureCelsius?: number | null | undefined;
    }, {
        lotNumber: string;
        purchaseOrderItemId: string;
        quantityReceived: number;
        storageLocationId?: string | null | undefined;
        expiryDate?: string | null | undefined;
        temperatureCelsius?: number | null | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "confirmar_total" | "confirmar_parcial" | "recusar";
    items: {
        lotNumber: string;
        purchaseOrderItemId: string;
        quantityReceived: number;
        storageLocationId?: string | null | undefined;
        expiryDate?: string | null | undefined;
        temperatureCelsius?: number | null | undefined;
    }[];
    orderId: string;
    nfeXml?: string | undefined;
    nfeNumber?: string | undefined;
    nfeSeries?: string | undefined;
    issuerCnpj?: string | undefined;
    issueDate?: string | undefined;
    divergenceJustification?: string | undefined;
    supervisorApproved?: boolean | undefined;
    refusalReason?: string | undefined;
}, {
    type: "confirmar_total" | "confirmar_parcial" | "recusar";
    items: {
        lotNumber: string;
        purchaseOrderItemId: string;
        quantityReceived: number;
        storageLocationId?: string | null | undefined;
        expiryDate?: string | null | undefined;
        temperatureCelsius?: number | null | undefined;
    }[];
    orderId: string;
    nfeXml?: string | undefined;
    nfeNumber?: string | undefined;
    nfeSeries?: string | undefined;
    issuerCnpj?: string | undefined;
    issueDate?: string | undefined;
    divergenceJustification?: string | undefined;
    supervisorApproved?: boolean | undefined;
    refusalReason?: string | undefined;
}>, {
    type: "confirmar_total" | "confirmar_parcial" | "recusar";
    items: {
        lotNumber: string;
        purchaseOrderItemId: string;
        quantityReceived: number;
        storageLocationId?: string | null | undefined;
        expiryDate?: string | null | undefined;
        temperatureCelsius?: number | null | undefined;
    }[];
    orderId: string;
    nfeXml?: string | undefined;
    nfeNumber?: string | undefined;
    nfeSeries?: string | undefined;
    issuerCnpj?: string | undefined;
    issueDate?: string | undefined;
    divergenceJustification?: string | undefined;
    supervisorApproved?: boolean | undefined;
    refusalReason?: string | undefined;
}, {
    type: "confirmar_total" | "confirmar_parcial" | "recusar";
    items: {
        lotNumber: string;
        purchaseOrderItemId: string;
        quantityReceived: number;
        storageLocationId?: string | null | undefined;
        expiryDate?: string | null | undefined;
        temperatureCelsius?: number | null | undefined;
    }[];
    orderId: string;
    nfeXml?: string | undefined;
    nfeNumber?: string | undefined;
    nfeSeries?: string | undefined;
    issuerCnpj?: string | undefined;
    issueDate?: string | undefined;
    divergenceJustification?: string | undefined;
    supervisorApproved?: boolean | undefined;
    refusalReason?: string | undefined;
}>;
export type ReceiveOrderInput = z.infer<typeof receiveOrderSchema>;
export declare const listOrdersSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["rascunho", "pendente_aprovacao", "aprovado", "rejeitado", "devolvido", "enviado", "parcialmente_recebido", "recebido", "cancelado"]>>;
    urgency: z.ZodOptional<z.ZodEnum<["normal", "urgente", "emergencia"]>>;
    supplierId: z.ZodOptional<z.ZodString>;
    dateFrom: z.ZodOptional<z.ZodString>;
    dateTo: z.ZodOptional<z.ZodString>;
    search: z.ZodOptional<z.ZodString>;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    status?: "rascunho" | "cancelado" | "pendente_aprovacao" | "aprovado" | "rejeitado" | "devolvido" | "enviado" | "parcialmente_recebido" | "recebido" | undefined;
    search?: string | undefined;
    dateFrom?: string | undefined;
    dateTo?: string | undefined;
    supplierId?: string | undefined;
    urgency?: "normal" | "emergencia" | "urgente" | undefined;
}, {
    status?: "rascunho" | "cancelado" | "pendente_aprovacao" | "aprovado" | "rejeitado" | "devolvido" | "enviado" | "parcialmente_recebido" | "recebido" | undefined;
    search?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    dateFrom?: string | undefined;
    dateTo?: string | undefined;
    supplierId?: string | undefined;
    urgency?: "normal" | "emergencia" | "urgente" | undefined;
}>;
export type ListOrdersInput = z.infer<typeof listOrdersSchema>;
export declare const getOrderSchema: z.ZodObject<{
    orderId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    orderId: string;
}, {
    orderId: string;
}>;
export type GetOrderInput = z.infer<typeof getOrderSchema>;
export declare const parseNfeSchema: z.ZodObject<{
    xml: z.ZodString;
}, "strip", z.ZodTypeAny, {
    xml: string;
}, {
    xml: string;
}>;
export type ParseNfeInput = z.infer<typeof parseNfeSchema>;
export declare const listSuggestionsSchema: z.ZodObject<{
    supplierId: z.ZodOptional<z.ZodString>;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    supplierId?: string | undefined;
}, {
    page?: number | undefined;
    limit?: number | undefined;
    supplierId?: string | undefined;
}>;
export type ListSuggestionsInput = z.infer<typeof listSuggestionsSchema>;
export declare const getPurchaseSettingsSchema: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
export type GetPurchaseSettingsInput = z.infer<typeof getPurchaseSettingsSchema>;
export interface PurchaseSuggestion {
    productId: string;
    productName: string;
    sku: string | null;
    unit: string;
    qtyAtual: number;
    reorderPoint: number;
    qtySugerida: number;
    maxStock: number | null;
    suggestedSupplierId: string | null;
    suggestedSupplierName: string | null;
    lastUnitCost: number | null;
    lastOrderDate: string | null;
    demandaProxima: boolean;
    procedureCount: number;
    stockStatus: 'RUPTURA' | 'CRITICO' | 'ATENCAO';
}
export interface PurchaseOrderItem {
    id: string;
    productId: string;
    productName: string;
    sku: string | null;
    unit: string;
    quantityOrdered: number;
    quantityReceived: number;
    unitCost: number;
    totalCost: number;
    notes: string | null;
}
export interface PurchaseOrderStatusHistory {
    id: string;
    fromStatus: OrderStatus | null;
    toStatus: OrderStatus;
    changedBy: string | null;
    changedByName: string | null;
    changedByLabel: string | null;
    changedAt: string;
    reason: string | null;
}
export interface PurchaseOrder {
    id: string;
    orderNumber: string | null;
    supplierId: string;
    supplierName: string;
    status: OrderStatus;
    urgency: OrderUrgency;
    totalAmount: number;
    notes: string | null;
    expectedDelivery: string | null;
    createdBy: string | null;
    createdByName: string | null;
    createdAt: string;
    submittedAt: string | null;
    approvedAt: string | null;
    approvedBy: string | null;
    rejectedAt: string | null;
    rejectionReason: string | null;
    returnedAt: string | null;
    returnReason: string | null;
    sentAt: string | null;
    autoApproved: boolean;
    items?: PurchaseOrderItem[];
    history?: PurchaseOrderStatusHistory[];
}
export interface PurchaseSettings {
    autoApprovalThreshold: number;
    divergenceTolerancePct: number;
    divergenceSupervisorPct: number;
    orderNumberPrefix: string;
}
export interface NfeParsedItem {
    codigo: string;
    descricao: string;
    quantidade: number;
    valorUnitario: number;
    valorTotal: number;
}
export interface NfeParsed {
    numero: string;
    serie: string;
    cnpjEmitente: string;
    dataEmissao: string;
    itens: NfeParsedItem[];
}
export interface ReceiveOrderResult {
    orderId: string;
    newStatus: OrderStatus;
    lotsCreated: number;
    movementsCreated: number;
    cnpjDivergent: boolean;
}
export {};
//# sourceMappingURL=purchase.schema.d.ts.map