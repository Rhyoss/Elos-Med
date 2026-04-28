import { z } from 'zod';
export declare const PRODUCT_UNITS: readonly ["unidade", "ml", "mg", "mcg", "ampola", "frasco", "caixa", "par", "kit", "pacote", "rolo", "litro", "grama"];
export type ProductUnit = (typeof PRODUCT_UNITS)[number];
export declare const ANVISA_CONTROL_CLASSES: readonly ["A1", "A2", "A3", "B1", "B2", "C1", "C2", "C3", "C4", "C5", "D1", "D2", "E", "F1", "F2", "F3"];
export type AnvisaControlClass = (typeof ANVISA_CONTROL_CLASSES)[number];
export declare const STORAGE_TYPES: readonly ["geladeira", "freezer", "temperatura_ambiente", "controlado", "descartavel"];
export type StorageType = (typeof STORAGE_TYPES)[number];
export declare const REFRIGERATED_STORAGE_TYPES: ReadonlyArray<StorageType>;
export declare const STORAGE_TYPE_LABELS: Record<StorageType, string>;
export declare const STOCK_STATUSES: readonly ["OK", "ATENCAO", "CRITICO", "RUPTURA", "VENCIMENTO_PROXIMO"];
export type StockStatus = (typeof STOCK_STATUSES)[number];
export declare const STOCK_STATUS_LABELS: Record<StockStatus, string>;
export declare const ADJUSTMENT_REASONS: readonly ["contagem", "perda", "correcao"];
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];
export declare const ADJUSTMENT_REASON_LABELS: Record<AdjustmentReason, string>;
export declare function isValidBarcode(code: string): boolean;
export declare function isValidBrazilianPhone(phone: string): boolean;
export declare function isValidAnvisaRegistration(reg: string): boolean;
export declare const createCategorySchema: z.ZodObject<{
    name: z.ZodString;
    parentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description?: string | null | undefined;
    parentId?: string | null | undefined;
}, {
    name: string;
    description?: string | null | undefined;
    parentId?: string | null | undefined;
}>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export declare const updateCategorySchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    parentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name?: string | undefined;
    description?: string | null | undefined;
    parentId?: string | null | undefined;
}, {
    id: string;
    name?: string | undefined;
    description?: string | null | undefined;
    parentId?: string | null | undefined;
}>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export declare const listCategoriesSchema: z.ZodObject<{
    parentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    parentId?: string | null | undefined;
}, {
    parentId?: string | null | undefined;
}>;
export type ListCategoriesInput = z.infer<typeof listCategoriesSchema>;
export declare const createSupplierSchema: z.ZodObject<{
    name: z.ZodString;
    cnpj: z.ZodEffects<z.ZodString, string, string>;
    contactName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    phone: z.ZodEffects<z.ZodString, string, string>;
    email: z.ZodString;
    paymentTerms: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    leadTimeDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    address: z.ZodDefault<z.ZodObject<{
        street: z.ZodOptional<z.ZodString>;
        city: z.ZodOptional<z.ZodString>;
        state: z.ZodOptional<z.ZodString>;
        zip: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        street?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        zip?: string | undefined;
    }, {
        street?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        zip?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    email: string;
    phone: string;
    address: {
        street?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        zip?: string | undefined;
    };
    cnpj: string;
    contactName?: string | null | undefined;
    paymentTerms?: string | null | undefined;
    leadTimeDays?: number | null | undefined;
}, {
    name: string;
    email: string;
    phone: string;
    cnpj: string;
    address?: {
        street?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        zip?: string | undefined;
    } | undefined;
    contactName?: string | null | undefined;
    paymentTerms?: string | null | undefined;
    leadTimeDays?: number | null | undefined;
}>;
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export declare const updateSupplierSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    cnpj: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    contactName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    phone: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    email: z.ZodOptional<z.ZodString>;
    paymentTerms: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    leadTimeDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    address: z.ZodOptional<z.ZodObject<{
        street: z.ZodOptional<z.ZodString>;
        city: z.ZodOptional<z.ZodString>;
        state: z.ZodOptional<z.ZodString>;
        zip: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        street?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        zip?: string | undefined;
    }, {
        street?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        zip?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name?: string | undefined;
    email?: string | undefined;
    phone?: string | undefined;
    address?: {
        street?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        zip?: string | undefined;
    } | undefined;
    cnpj?: string | undefined;
    contactName?: string | null | undefined;
    paymentTerms?: string | null | undefined;
    leadTimeDays?: number | null | undefined;
}, {
    id: string;
    name?: string | undefined;
    email?: string | undefined;
    phone?: string | undefined;
    address?: {
        street?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        zip?: string | undefined;
    } | undefined;
    cnpj?: string | undefined;
    contactName?: string | null | undefined;
    paymentTerms?: string | null | undefined;
    leadTimeDays?: number | null | undefined;
}>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export declare const listSuppliersSchema: z.ZodObject<{
    search: z.ZodOptional<z.ZodString>;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    search?: string | undefined;
}, {
    search?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
}>;
export type ListSuppliersInput = z.infer<typeof listSuppliersSchema>;
export declare const createStorageLocationSchema: z.ZodEffects<z.ZodObject<{
    name: z.ZodString;
    type: z.ZodEnum<["geladeira", "freezer", "temperatura_ambiente", "controlado", "descartavel"]>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    minTempC: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    maxTempC: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    type: "geladeira" | "freezer" | "temperatura_ambiente" | "controlado" | "descartavel";
    name: string;
    description?: string | null | undefined;
    minTempC?: number | null | undefined;
    maxTempC?: number | null | undefined;
}, {
    type: "geladeira" | "freezer" | "temperatura_ambiente" | "controlado" | "descartavel";
    name: string;
    description?: string | null | undefined;
    minTempC?: number | null | undefined;
    maxTempC?: number | null | undefined;
}>, {
    type: "geladeira" | "freezer" | "temperatura_ambiente" | "controlado" | "descartavel";
    name: string;
    description?: string | null | undefined;
    minTempC?: number | null | undefined;
    maxTempC?: number | null | undefined;
}, {
    type: "geladeira" | "freezer" | "temperatura_ambiente" | "controlado" | "descartavel";
    name: string;
    description?: string | null | undefined;
    minTempC?: number | null | undefined;
    maxTempC?: number | null | undefined;
}>;
export type CreateStorageLocationInput = z.infer<typeof createStorageLocationSchema>;
export declare const updateStorageLocationSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<["geladeira", "freezer", "temperatura_ambiente", "controlado", "descartavel"]>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    minTempC: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    maxTempC: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    type?: "geladeira" | "freezer" | "temperatura_ambiente" | "controlado" | "descartavel" | undefined;
    name?: string | undefined;
    description?: string | null | undefined;
    minTempC?: number | null | undefined;
    maxTempC?: number | null | undefined;
}, {
    id: string;
    type?: "geladeira" | "freezer" | "temperatura_ambiente" | "controlado" | "descartavel" | undefined;
    name?: string | undefined;
    description?: string | null | undefined;
    minTempC?: number | null | undefined;
    maxTempC?: number | null | undefined;
}>;
export type UpdateStorageLocationInput = z.infer<typeof updateStorageLocationSchema>;
export declare const listStorageLocationsSchema: z.ZodObject<{
    refrigerationOnly: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    refrigerationOnly?: boolean | undefined;
}, {
    refrigerationOnly?: boolean | undefined;
}>;
export type ListStorageLocationsInput = z.infer<typeof listStorageLocationsSchema>;
export declare const createProductSchema: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodObject<{
    name: z.ZodString;
    sku: z.ZodString;
    barcode: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, string | null | undefined>;
    categoryId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    preferredSupplierId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    brand: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    unit: z.ZodEnum<["unidade", "ml", "mg", "mcg", "ampola", "frasco", "caixa", "par", "kit", "pacote", "rolo", "litro", "grama"]>;
    unitCost: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    salePrice: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    minStock: z.ZodDefault<z.ZodNumber>;
    maxStock: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    reorderPoint: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    anvisaRegistration: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, string | null | undefined>;
    isControlled: z.ZodDefault<z.ZodBoolean>;
    controlClass: z.ZodOptional<z.ZodNullable<z.ZodEnum<["A1", "A2", "A3", "B1", "B2", "C1", "C2", "C3", "C4", "C5", "D1", "D2", "E", "F1", "F2", "F3"]>>>;
    isColdChain: z.ZodDefault<z.ZodBoolean>;
    defaultStorageLocationId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    substituteIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    requiresPrescription: z.ZodDefault<z.ZodBoolean>;
    isConsumable: z.ZodDefault<z.ZodBoolean>;
    photoObjectKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    sku: string;
    unit: "unidade" | "ml" | "mg" | "mcg" | "ampola" | "frasco" | "caixa" | "par" | "kit" | "pacote" | "rolo" | "litro" | "grama";
    minStock: number;
    isControlled: boolean;
    isColdChain: boolean;
    substituteIds: string[];
    requiresPrescription: boolean;
    isConsumable: boolean;
    brand?: string | null | undefined;
    barcode?: string | null | undefined;
    categoryId?: string | null | undefined;
    preferredSupplierId?: string | null | undefined;
    unitCost?: number | null | undefined;
    salePrice?: number | null | undefined;
    maxStock?: number | null | undefined;
    reorderPoint?: number | null | undefined;
    anvisaRegistration?: string | null | undefined;
    controlClass?: "A1" | "A2" | "A3" | "B1" | "B2" | "C1" | "C2" | "C3" | "C4" | "C5" | "D1" | "D2" | "E" | "F1" | "F2" | "F3" | null | undefined;
    defaultStorageLocationId?: string | null | undefined;
    photoObjectKey?: string | null | undefined;
}, {
    name: string;
    sku: string;
    unit: "unidade" | "ml" | "mg" | "mcg" | "ampola" | "frasco" | "caixa" | "par" | "kit" | "pacote" | "rolo" | "litro" | "grama";
    brand?: string | null | undefined;
    barcode?: string | null | undefined;
    categoryId?: string | null | undefined;
    preferredSupplierId?: string | null | undefined;
    unitCost?: number | null | undefined;
    salePrice?: number | null | undefined;
    minStock?: number | undefined;
    maxStock?: number | null | undefined;
    reorderPoint?: number | null | undefined;
    anvisaRegistration?: string | null | undefined;
    isControlled?: boolean | undefined;
    controlClass?: "A1" | "A2" | "A3" | "B1" | "B2" | "C1" | "C2" | "C3" | "C4" | "C5" | "D1" | "D2" | "E" | "F1" | "F2" | "F3" | null | undefined;
    isColdChain?: boolean | undefined;
    defaultStorageLocationId?: string | null | undefined;
    substituteIds?: string[] | undefined;
    requiresPrescription?: boolean | undefined;
    isConsumable?: boolean | undefined;
    photoObjectKey?: string | null | undefined;
}>, {
    name: string;
    sku: string;
    unit: "unidade" | "ml" | "mg" | "mcg" | "ampola" | "frasco" | "caixa" | "par" | "kit" | "pacote" | "rolo" | "litro" | "grama";
    minStock: number;
    isControlled: boolean;
    isColdChain: boolean;
    substituteIds: string[];
    requiresPrescription: boolean;
    isConsumable: boolean;
    brand?: string | null | undefined;
    barcode?: string | null | undefined;
    categoryId?: string | null | undefined;
    preferredSupplierId?: string | null | undefined;
    unitCost?: number | null | undefined;
    salePrice?: number | null | undefined;
    maxStock?: number | null | undefined;
    reorderPoint?: number | null | undefined;
    anvisaRegistration?: string | null | undefined;
    controlClass?: "A1" | "A2" | "A3" | "B1" | "B2" | "C1" | "C2" | "C3" | "C4" | "C5" | "D1" | "D2" | "E" | "F1" | "F2" | "F3" | null | undefined;
    defaultStorageLocationId?: string | null | undefined;
    photoObjectKey?: string | null | undefined;
}, {
    name: string;
    sku: string;
    unit: "unidade" | "ml" | "mg" | "mcg" | "ampola" | "frasco" | "caixa" | "par" | "kit" | "pacote" | "rolo" | "litro" | "grama";
    brand?: string | null | undefined;
    barcode?: string | null | undefined;
    categoryId?: string | null | undefined;
    preferredSupplierId?: string | null | undefined;
    unitCost?: number | null | undefined;
    salePrice?: number | null | undefined;
    minStock?: number | undefined;
    maxStock?: number | null | undefined;
    reorderPoint?: number | null | undefined;
    anvisaRegistration?: string | null | undefined;
    isControlled?: boolean | undefined;
    controlClass?: "A1" | "A2" | "A3" | "B1" | "B2" | "C1" | "C2" | "C3" | "C4" | "C5" | "D1" | "D2" | "E" | "F1" | "F2" | "F3" | null | undefined;
    isColdChain?: boolean | undefined;
    defaultStorageLocationId?: string | null | undefined;
    substituteIds?: string[] | undefined;
    requiresPrescription?: boolean | undefined;
    isConsumable?: boolean | undefined;
    photoObjectKey?: string | null | undefined;
}>, {
    name: string;
    sku: string;
    unit: "unidade" | "ml" | "mg" | "mcg" | "ampola" | "frasco" | "caixa" | "par" | "kit" | "pacote" | "rolo" | "litro" | "grama";
    minStock: number;
    isControlled: boolean;
    isColdChain: boolean;
    substituteIds: string[];
    requiresPrescription: boolean;
    isConsumable: boolean;
    brand?: string | null | undefined;
    barcode?: string | null | undefined;
    categoryId?: string | null | undefined;
    preferredSupplierId?: string | null | undefined;
    unitCost?: number | null | undefined;
    salePrice?: number | null | undefined;
    maxStock?: number | null | undefined;
    reorderPoint?: number | null | undefined;
    anvisaRegistration?: string | null | undefined;
    controlClass?: "A1" | "A2" | "A3" | "B1" | "B2" | "C1" | "C2" | "C3" | "C4" | "C5" | "D1" | "D2" | "E" | "F1" | "F2" | "F3" | null | undefined;
    defaultStorageLocationId?: string | null | undefined;
    photoObjectKey?: string | null | undefined;
}, {
    name: string;
    sku: string;
    unit: "unidade" | "ml" | "mg" | "mcg" | "ampola" | "frasco" | "caixa" | "par" | "kit" | "pacote" | "rolo" | "litro" | "grama";
    brand?: string | null | undefined;
    barcode?: string | null | undefined;
    categoryId?: string | null | undefined;
    preferredSupplierId?: string | null | undefined;
    unitCost?: number | null | undefined;
    salePrice?: number | null | undefined;
    minStock?: number | undefined;
    maxStock?: number | null | undefined;
    reorderPoint?: number | null | undefined;
    anvisaRegistration?: string | null | undefined;
    isControlled?: boolean | undefined;
    controlClass?: "A1" | "A2" | "A3" | "B1" | "B2" | "C1" | "C2" | "C3" | "C4" | "C5" | "D1" | "D2" | "E" | "F1" | "F2" | "F3" | null | undefined;
    isColdChain?: boolean | undefined;
    defaultStorageLocationId?: string | null | undefined;
    substituteIds?: string[] | undefined;
    requiresPrescription?: boolean | undefined;
    isConsumable?: boolean | undefined;
    photoObjectKey?: string | null | undefined;
}>, {
    name: string;
    sku: string;
    unit: "unidade" | "ml" | "mg" | "mcg" | "ampola" | "frasco" | "caixa" | "par" | "kit" | "pacote" | "rolo" | "litro" | "grama";
    minStock: number;
    isControlled: boolean;
    isColdChain: boolean;
    substituteIds: string[];
    requiresPrescription: boolean;
    isConsumable: boolean;
    brand?: string | null | undefined;
    barcode?: string | null | undefined;
    categoryId?: string | null | undefined;
    preferredSupplierId?: string | null | undefined;
    unitCost?: number | null | undefined;
    salePrice?: number | null | undefined;
    maxStock?: number | null | undefined;
    reorderPoint?: number | null | undefined;
    anvisaRegistration?: string | null | undefined;
    controlClass?: "A1" | "A2" | "A3" | "B1" | "B2" | "C1" | "C2" | "C3" | "C4" | "C5" | "D1" | "D2" | "E" | "F1" | "F2" | "F3" | null | undefined;
    defaultStorageLocationId?: string | null | undefined;
    photoObjectKey?: string | null | undefined;
}, {
    name: string;
    sku: string;
    unit: "unidade" | "ml" | "mg" | "mcg" | "ampola" | "frasco" | "caixa" | "par" | "kit" | "pacote" | "rolo" | "litro" | "grama";
    brand?: string | null | undefined;
    barcode?: string | null | undefined;
    categoryId?: string | null | undefined;
    preferredSupplierId?: string | null | undefined;
    unitCost?: number | null | undefined;
    salePrice?: number | null | undefined;
    minStock?: number | undefined;
    maxStock?: number | null | undefined;
    reorderPoint?: number | null | undefined;
    anvisaRegistration?: string | null | undefined;
    isControlled?: boolean | undefined;
    controlClass?: "A1" | "A2" | "A3" | "B1" | "B2" | "C1" | "C2" | "C3" | "C4" | "C5" | "D1" | "D2" | "E" | "F1" | "F2" | "F3" | null | undefined;
    isColdChain?: boolean | undefined;
    defaultStorageLocationId?: string | null | undefined;
    substituteIds?: string[] | undefined;
    requiresPrescription?: boolean | undefined;
    isConsumable?: boolean | undefined;
    photoObjectKey?: string | null | undefined;
}>, {
    name: string;
    sku: string;
    unit: "unidade" | "ml" | "mg" | "mcg" | "ampola" | "frasco" | "caixa" | "par" | "kit" | "pacote" | "rolo" | "litro" | "grama";
    minStock: number;
    isControlled: boolean;
    isColdChain: boolean;
    substituteIds: string[];
    requiresPrescription: boolean;
    isConsumable: boolean;
    brand?: string | null | undefined;
    barcode?: string | null | undefined;
    categoryId?: string | null | undefined;
    preferredSupplierId?: string | null | undefined;
    unitCost?: number | null | undefined;
    salePrice?: number | null | undefined;
    maxStock?: number | null | undefined;
    reorderPoint?: number | null | undefined;
    anvisaRegistration?: string | null | undefined;
    controlClass?: "A1" | "A2" | "A3" | "B1" | "B2" | "C1" | "C2" | "C3" | "C4" | "C5" | "D1" | "D2" | "E" | "F1" | "F2" | "F3" | null | undefined;
    defaultStorageLocationId?: string | null | undefined;
    photoObjectKey?: string | null | undefined;
}, {
    name: string;
    sku: string;
    unit: "unidade" | "ml" | "mg" | "mcg" | "ampola" | "frasco" | "caixa" | "par" | "kit" | "pacote" | "rolo" | "litro" | "grama";
    brand?: string | null | undefined;
    barcode?: string | null | undefined;
    categoryId?: string | null | undefined;
    preferredSupplierId?: string | null | undefined;
    unitCost?: number | null | undefined;
    salePrice?: number | null | undefined;
    minStock?: number | undefined;
    maxStock?: number | null | undefined;
    reorderPoint?: number | null | undefined;
    anvisaRegistration?: string | null | undefined;
    isControlled?: boolean | undefined;
    controlClass?: "A1" | "A2" | "A3" | "B1" | "B2" | "C1" | "C2" | "C3" | "C4" | "C5" | "D1" | "D2" | "E" | "F1" | "F2" | "F3" | null | undefined;
    isColdChain?: boolean | undefined;
    defaultStorageLocationId?: string | null | undefined;
    substituteIds?: string[] | undefined;
    requiresPrescription?: boolean | undefined;
    isConsumable?: boolean | undefined;
    photoObjectKey?: string | null | undefined;
}>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export declare const updateProductSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    sku: z.ZodOptional<z.ZodString>;
    barcode: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, string | null | undefined>;
    categoryId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    preferredSupplierId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    brand: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    unit: z.ZodOptional<z.ZodEnum<["unidade", "ml", "mg", "mcg", "ampola", "frasco", "caixa", "par", "kit", "pacote", "rolo", "litro", "grama"]>>;
    unitCost: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    salePrice: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    minStock: z.ZodOptional<z.ZodNumber>;
    maxStock: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    reorderPoint: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    anvisaRegistration: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    isControlled: z.ZodOptional<z.ZodBoolean>;
    controlClass: z.ZodOptional<z.ZodNullable<z.ZodEnum<["A1", "A2", "A3", "B1", "B2", "C1", "C2", "C3", "C4", "C5", "D1", "D2", "E", "F1", "F2", "F3"]>>>;
    isColdChain: z.ZodOptional<z.ZodBoolean>;
    defaultStorageLocationId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    substituteIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    requiresPrescription: z.ZodOptional<z.ZodBoolean>;
    isConsumable: z.ZodOptional<z.ZodBoolean>;
    photoObjectKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name?: string | undefined;
    brand?: string | null | undefined;
    isActive?: boolean | undefined;
    sku?: string | undefined;
    barcode?: string | null | undefined;
    categoryId?: string | null | undefined;
    preferredSupplierId?: string | null | undefined;
    unit?: "unidade" | "ml" | "mg" | "mcg" | "ampola" | "frasco" | "caixa" | "par" | "kit" | "pacote" | "rolo" | "litro" | "grama" | undefined;
    unitCost?: number | null | undefined;
    salePrice?: number | null | undefined;
    minStock?: number | undefined;
    maxStock?: number | null | undefined;
    reorderPoint?: number | null | undefined;
    anvisaRegistration?: string | null | undefined;
    isControlled?: boolean | undefined;
    controlClass?: "A1" | "A2" | "A3" | "B1" | "B2" | "C1" | "C2" | "C3" | "C4" | "C5" | "D1" | "D2" | "E" | "F1" | "F2" | "F3" | null | undefined;
    isColdChain?: boolean | undefined;
    defaultStorageLocationId?: string | null | undefined;
    substituteIds?: string[] | undefined;
    requiresPrescription?: boolean | undefined;
    isConsumable?: boolean | undefined;
    photoObjectKey?: string | null | undefined;
}, {
    id: string;
    name?: string | undefined;
    brand?: string | null | undefined;
    isActive?: boolean | undefined;
    sku?: string | undefined;
    barcode?: string | null | undefined;
    categoryId?: string | null | undefined;
    preferredSupplierId?: string | null | undefined;
    unit?: "unidade" | "ml" | "mg" | "mcg" | "ampola" | "frasco" | "caixa" | "par" | "kit" | "pacote" | "rolo" | "litro" | "grama" | undefined;
    unitCost?: number | null | undefined;
    salePrice?: number | null | undefined;
    minStock?: number | undefined;
    maxStock?: number | null | undefined;
    reorderPoint?: number | null | undefined;
    anvisaRegistration?: string | null | undefined;
    isControlled?: boolean | undefined;
    controlClass?: "A1" | "A2" | "A3" | "B1" | "B2" | "C1" | "C2" | "C3" | "C4" | "C5" | "D1" | "D2" | "E" | "F1" | "F2" | "F3" | null | undefined;
    isColdChain?: boolean | undefined;
    defaultStorageLocationId?: string | null | undefined;
    substituteIds?: string[] | undefined;
    requiresPrescription?: boolean | undefined;
    isConsumable?: boolean | undefined;
    photoObjectKey?: string | null | undefined;
}>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export declare const listProductsSchema: z.ZodObject<{
    search: z.ZodOptional<z.ZodString>;
    categoryId: z.ZodOptional<z.ZodString>;
    isActive: z.ZodOptional<z.ZodBoolean>;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    search?: string | undefined;
    isActive?: boolean | undefined;
    categoryId?: string | undefined;
}, {
    search?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    isActive?: boolean | undefined;
    categoryId?: string | undefined;
}>;
export type ListProductsInput = z.infer<typeof listProductsSchema>;
export declare const checkSkuSchema: z.ZodObject<{
    sku: z.ZodString;
    excludeId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    sku: string;
    excludeId?: string | undefined;
}, {
    sku: string;
    excludeId?: string | undefined;
}>;
export type CheckSkuInput = z.infer<typeof checkSkuSchema>;
export declare const listStockPositionSchema: z.ZodObject<{
    search: z.ZodOptional<z.ZodString>;
    categoryId: z.ZodOptional<z.ZodString>;
    statuses: z.ZodOptional<z.ZodArray<z.ZodEnum<["OK", "ATENCAO", "CRITICO", "RUPTURA", "VENCIMENTO_PROXIMO"]>, "many">>;
    storageLocationId: z.ZodOptional<z.ZodString>;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    search?: string | undefined;
    categoryId?: string | undefined;
    statuses?: ("OK" | "ATENCAO" | "CRITICO" | "RUPTURA" | "VENCIMENTO_PROXIMO")[] | undefined;
    storageLocationId?: string | undefined;
}, {
    search?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    categoryId?: string | undefined;
    statuses?: ("OK" | "ATENCAO" | "CRITICO" | "RUPTURA" | "VENCIMENTO_PROXIMO")[] | undefined;
    storageLocationId?: string | undefined;
}>;
export type ListStockPositionInput = z.infer<typeof listStockPositionSchema>;
export declare const adjustStockSchema: z.ZodObject<{
    productId: z.ZodString;
    quantity: z.ZodEffects<z.ZodNumber, number, number>;
    reason: z.ZodEnum<["contagem", "perda", "correcao"]>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reason: "contagem" | "perda" | "correcao";
    quantity: number;
    productId: string;
    notes?: string | undefined;
}, {
    reason: "contagem" | "perda" | "correcao";
    quantity: number;
    productId: string;
    notes?: string | undefined;
}>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export declare const listProductLotsSchema: z.ZodObject<{
    productId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    productId: string;
}, {
    productId: string;
}>;
export type ListProductLotsInput = z.infer<typeof listProductLotsSchema>;
export declare const listProductMovementsSchema: z.ZodObject<{
    productId: z.ZodString;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    productId: string;
}, {
    productId: string;
    page?: number | undefined;
    limit?: number | undefined;
}>;
export type ListProductMovementsInput = z.infer<typeof listProductMovementsSchema>;
export declare const EXPIRY_WARNING_DAYS: 60;
export declare const EXPIRY_CRITICAL_DAYS: 30;
export declare const MIN_JUSTIFICATION_LENGTH: 10;
export declare const MAX_JUSTIFICATION_LENGTH: 500;
export declare const MIN_LOT_NUMBER_LENGTH: 1;
export declare const MAX_LOT_NUMBER_LENGTH: 80;
export declare const LOT_STATUSES: readonly ["active", "consumed", "quarantined", "expired"];
export type LotStatus = (typeof LOT_STATUSES)[number];
export declare const LOT_STATUS_LABELS: Record<LotStatus, string>;
export declare const EXPIRY_ALERT_LEVELS: readonly ["none", "warning", "critical"];
export type ExpiryAlertLevel = (typeof EXPIRY_ALERT_LEVELS)[number];
export declare const EXPIRY_ALERT_LEVEL_LABELS: Record<ExpiryAlertLevel, string>;
export declare const MOVEMENT_TYPES: readonly ["entrada", "saida", "ajuste", "perda", "vencimento", "transferencia", "uso_paciente"];
export type MovementType = (typeof MOVEMENT_TYPES)[number];
export declare const MOVEMENT_TYPE_LABELS: Record<MovementType, string>;
export declare const MOVEMENT_REASONS: readonly ["procedimento", "venda", "perda", "descarte_vencido", "contagem", "correcao", "recebimento", "transferencia_entrada", "transferencia_saida", "inventario_inicial", "outro"];
export type MovementReason = (typeof MOVEMENT_REASONS)[number];
export declare const MOVEMENT_REASON_LABELS: Record<MovementReason, string>;
export declare const SAIDA_REASONS: ReadonlyArray<MovementReason>;
export declare const AJUSTE_REASONS: ReadonlyArray<MovementReason>;
export declare const ENTRADA_REASONS: ReadonlyArray<MovementReason>;
export declare const ALERT_TYPES: readonly ["lot_expiring", "low_stock", "critical_stock", "rupture"];
export type AlertType = (typeof ALERT_TYPES)[number];
export declare const ALERT_TYPE_LABELS: Record<AlertType, string>;
export declare const entryMovementSchema: z.ZodEffects<z.ZodObject<{
    type: z.ZodLiteral<"entrada">;
    productId: z.ZodString;
    lotNumber: z.ZodString;
    batchNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    expiryDate: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>>;
    manufacturedDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    quantity: z.ZodNumber;
    unitCost: z.ZodNumber;
    supplierId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    storageLocationId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    purchaseOrderItemId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    reason: z.ZodDefault<z.ZodEnum<["outro" | "contagem" | "perda" | "correcao" | "procedimento" | "venda" | "descarte_vencido" | "recebimento" | "transferencia_entrada" | "transferencia_saida" | "inventario_inicial", ...("outro" | "contagem" | "perda" | "correcao" | "procedimento" | "venda" | "descarte_vencido" | "recebimento" | "transferencia_entrada" | "transferencia_saida" | "inventario_inicial")[]]>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    acceptExpired: z.ZodDefault<z.ZodBoolean>;
    acceptExpiredReason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    type: "entrada";
    reason: "outro" | "contagem" | "perda" | "correcao" | "procedimento" | "venda" | "descarte_vencido" | "recebimento" | "transferencia_entrada" | "transferencia_saida" | "inventario_inicial";
    quantity: number;
    productId: string;
    unitCost: number;
    lotNumber: string;
    acceptExpired: boolean;
    notes?: string | null | undefined;
    storageLocationId?: string | null | undefined;
    batchNumber?: string | null | undefined;
    expiryDate?: string | null | undefined;
    manufacturedDate?: string | null | undefined;
    supplierId?: string | null | undefined;
    purchaseOrderItemId?: string | null | undefined;
    acceptExpiredReason?: string | null | undefined;
}, {
    type: "entrada";
    quantity: number;
    productId: string;
    unitCost: number;
    lotNumber: string;
    reason?: "outro" | "contagem" | "perda" | "correcao" | "procedimento" | "venda" | "descarte_vencido" | "recebimento" | "transferencia_entrada" | "transferencia_saida" | "inventario_inicial" | undefined;
    notes?: string | null | undefined;
    storageLocationId?: string | null | undefined;
    batchNumber?: string | null | undefined;
    expiryDate?: string | null | undefined;
    manufacturedDate?: string | null | undefined;
    supplierId?: string | null | undefined;
    purchaseOrderItemId?: string | null | undefined;
    acceptExpired?: boolean | undefined;
    acceptExpiredReason?: string | null | undefined;
}>, {
    type: "entrada";
    reason: "outro" | "contagem" | "perda" | "correcao" | "procedimento" | "venda" | "descarte_vencido" | "recebimento" | "transferencia_entrada" | "transferencia_saida" | "inventario_inicial";
    quantity: number;
    productId: string;
    unitCost: number;
    lotNumber: string;
    acceptExpired: boolean;
    notes?: string | null | undefined;
    storageLocationId?: string | null | undefined;
    batchNumber?: string | null | undefined;
    expiryDate?: string | null | undefined;
    manufacturedDate?: string | null | undefined;
    supplierId?: string | null | undefined;
    purchaseOrderItemId?: string | null | undefined;
    acceptExpiredReason?: string | null | undefined;
}, {
    type: "entrada";
    quantity: number;
    productId: string;
    unitCost: number;
    lotNumber: string;
    reason?: "outro" | "contagem" | "perda" | "correcao" | "procedimento" | "venda" | "descarte_vencido" | "recebimento" | "transferencia_entrada" | "transferencia_saida" | "inventario_inicial" | undefined;
    notes?: string | null | undefined;
    storageLocationId?: string | null | undefined;
    batchNumber?: string | null | undefined;
    expiryDate?: string | null | undefined;
    manufacturedDate?: string | null | undefined;
    supplierId?: string | null | undefined;
    purchaseOrderItemId?: string | null | undefined;
    acceptExpired?: boolean | undefined;
    acceptExpiredReason?: string | null | undefined;
}>;
export declare const exitMovementSchema: z.ZodEffects<z.ZodObject<{
    type: z.ZodLiteral<"saida">;
    productId: z.ZodString;
    lotId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    quantity: z.ZodNumber;
    reason: z.ZodEnum<["outro" | "contagem" | "perda" | "correcao" | "procedimento" | "venda" | "descarte_vencido" | "recebimento" | "transferencia_entrada" | "transferencia_saida" | "inventario_inicial", ...("outro" | "contagem" | "perda" | "correcao" | "procedimento" | "venda" | "descarte_vencido" | "recebimento" | "transferencia_entrada" | "transferencia_saida" | "inventario_inicial")[]]>;
    justification: z.ZodOptional<z.ZodString>;
    encounterId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    invoiceId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    type: "saida";
    reason: "outro" | "contagem" | "perda" | "correcao" | "procedimento" | "venda" | "descarte_vencido" | "recebimento" | "transferencia_entrada" | "transferencia_saida" | "inventario_inicial";
    quantity: number;
    productId: string;
    notes?: string | null | undefined;
    justification?: string | undefined;
    encounterId?: string | null | undefined;
    lotId?: string | null | undefined;
    invoiceId?: string | null | undefined;
}, {
    type: "saida";
    reason: "outro" | "contagem" | "perda" | "correcao" | "procedimento" | "venda" | "descarte_vencido" | "recebimento" | "transferencia_entrada" | "transferencia_saida" | "inventario_inicial";
    quantity: number;
    productId: string;
    notes?: string | null | undefined;
    justification?: string | undefined;
    encounterId?: string | null | undefined;
    lotId?: string | null | undefined;
    invoiceId?: string | null | undefined;
}>, {
    type: "saida";
    reason: "outro" | "contagem" | "perda" | "correcao" | "procedimento" | "venda" | "descarte_vencido" | "recebimento" | "transferencia_entrada" | "transferencia_saida" | "inventario_inicial";
    quantity: number;
    productId: string;
    notes?: string | null | undefined;
    justification?: string | undefined;
    encounterId?: string | null | undefined;
    lotId?: string | null | undefined;
    invoiceId?: string | null | undefined;
}, {
    type: "saida";
    reason: "outro" | "contagem" | "perda" | "correcao" | "procedimento" | "venda" | "descarte_vencido" | "recebimento" | "transferencia_entrada" | "transferencia_saida" | "inventario_inicial";
    quantity: number;
    productId: string;
    notes?: string | null | undefined;
    justification?: string | undefined;
    encounterId?: string | null | undefined;
    lotId?: string | null | undefined;
    invoiceId?: string | null | undefined;
}>;
export declare const adjustMovementSchema: z.ZodObject<{
    type: z.ZodLiteral<"ajuste">;
    productId: z.ZodString;
    lotId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    delta: z.ZodEffects<z.ZodNumber, number, number>;
    reason: z.ZodEnum<["outro" | "contagem" | "perda" | "correcao" | "procedimento" | "venda" | "descarte_vencido" | "recebimento" | "transferencia_entrada" | "transferencia_saida" | "inventario_inicial", ...("outro" | "contagem" | "perda" | "correcao" | "procedimento" | "venda" | "descarte_vencido" | "recebimento" | "transferencia_entrada" | "transferencia_saida" | "inventario_inicial")[]]>;
    justification: z.ZodString;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    type: "ajuste";
    reason: "outro" | "contagem" | "perda" | "correcao" | "procedimento" | "venda" | "descarte_vencido" | "recebimento" | "transferencia_entrada" | "transferencia_saida" | "inventario_inicial";
    justification: string;
    productId: string;
    delta: number;
    notes?: string | null | undefined;
    lotId?: string | null | undefined;
}, {
    type: "ajuste";
    reason: "outro" | "contagem" | "perda" | "correcao" | "procedimento" | "venda" | "descarte_vencido" | "recebimento" | "transferencia_entrada" | "transferencia_saida" | "inventario_inicial";
    justification: string;
    productId: string;
    delta: number;
    notes?: string | null | undefined;
    lotId?: string | null | undefined;
}>;
export declare const transferMovementSchema: z.ZodEffects<z.ZodObject<{
    type: z.ZodLiteral<"transferencia">;
    productId: z.ZodString;
    lotId: z.ZodString;
    quantity: z.ZodNumber;
    fromStorageLocationId: z.ZodString;
    toStorageLocationId: z.ZodString;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    type: "transferencia";
    quantity: number;
    productId: string;
    lotId: string;
    fromStorageLocationId: string;
    toStorageLocationId: string;
    notes?: string | null | undefined;
}, {
    type: "transferencia";
    quantity: number;
    productId: string;
    lotId: string;
    fromStorageLocationId: string;
    toStorageLocationId: string;
    notes?: string | null | undefined;
}>, {
    type: "transferencia";
    quantity: number;
    productId: string;
    lotId: string;
    fromStorageLocationId: string;
    toStorageLocationId: string;
    notes?: string | null | undefined;
}, {
    type: "transferencia";
    quantity: number;
    productId: string;
    lotId: string;
    fromStorageLocationId: string;
    toStorageLocationId: string;
    notes?: string | null | undefined;
}>;
export type EntryMovementInput = z.infer<typeof entryMovementSchema>;
export type ExitMovementInput = z.infer<typeof exitMovementSchema>;
export type AdjustMovementInput = z.infer<typeof adjustMovementSchema>;
export type TransferMovementInput = z.infer<typeof transferMovementSchema>;
export declare const registerMovementSchema: z.ZodEffects<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"entrada">;
    productId: z.ZodString;
    lotNumber: z.ZodString;
    batchNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    expiryDate: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>>;
    manufacturedDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    quantity: z.ZodNumber;
    unitCost: z.ZodNumber;
    supplierId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    storageLocationId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    purchaseOrderItemId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    reason: z.ZodDefault<z.ZodEnum<["outro" | "contagem" | "perda" | "correcao" | "procedimento" | "venda" | "descarte_vencido" | "recebimento" | "transferencia_entrada" | "transferencia_saida" | "inventario_inicial", ...("outro" | "contagem" | "perda" | "correcao" | "procedimento" | "venda" | "descarte_vencido" | "recebimento" | "transferencia_entrada" | "transferencia_saida" | "inventario_inicial")[]]>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    acceptExpired: z.ZodDefault<z.ZodBoolean>;
    acceptExpiredReason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    type: "entrada";
    reason: "outro" | "contagem" | "perda" | "correcao" | "procedimento" | "venda" | "descarte_vencido" | "recebimento" | "transferencia_entrada" | "transferencia_saida" | "inventario_inicial";
    quantity: number;
    productId: string;
    unitCost: number;
    lotNumber: string;
    acceptExpired: boolean;
    notes?: string | null | undefined;
    storageLocationId?: string | null | undefined;
    batchNumber?: string | null | undefined;
    expiryDate?: string | null | undefined;
    manufacturedDate?: string | null | undefined;
    supplierId?: string | null | undefined;
    purchaseOrderItemId?: string | null | undefined;
    acceptExpiredReason?: string | null | undefined;
}, {
    type: "entrada";
    quantity: number;
    productId: string;
    unitCost: number;
    lotNumber: string;
    reason?: "outro" | "contagem" | "perda" | "correcao" | "procedimento" | "venda" | "descarte_vencido" | "recebimento" | "transferencia_entrada" | "transferencia_saida" | "inventario_inicial" | undefined;
    notes?: string | null | undefined;
    storageLocationId?: string | null | undefined;
    batchNumber?: string | null | undefined;
    expiryDate?: string | null | undefined;
    manufacturedDate?: string | null | undefined;
    supplierId?: string | null | undefined;
    purchaseOrderItemId?: string | null | undefined;
    acceptExpired?: boolean | undefined;
    acceptExpiredReason?: string | null | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"saida">;
    productId: z.ZodString;
    lotId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    quantity: z.ZodNumber;
    reason: z.ZodEnum<["outro" | "contagem" | "perda" | "correcao" | "procedimento" | "venda" | "descarte_vencido" | "recebimento" | "transferencia_entrada" | "transferencia_saida" | "inventario_inicial", ...("outro" | "contagem" | "perda" | "correcao" | "procedimento" | "venda" | "descarte_vencido" | "recebimento" | "transferencia_entrada" | "transferencia_saida" | "inventario_inicial")[]]>;
    justification: z.ZodOptional<z.ZodString>;
    encounterId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    invoiceId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    type: "saida";
    reason: "outro" | "contagem" | "perda" | "correcao" | "procedimento" | "venda" | "descarte_vencido" | "recebimento" | "transferencia_entrada" | "transferencia_saida" | "inventario_inicial";
    quantity: number;
    productId: string;
    notes?: string | null | undefined;
    justification?: string | undefined;
    encounterId?: string | null | undefined;
    lotId?: string | null | undefined;
    invoiceId?: string | null | undefined;
}, {
    type: "saida";
    reason: "outro" | "contagem" | "perda" | "correcao" | "procedimento" | "venda" | "descarte_vencido" | "recebimento" | "transferencia_entrada" | "transferencia_saida" | "inventario_inicial";
    quantity: number;
    productId: string;
    notes?: string | null | undefined;
    justification?: string | undefined;
    encounterId?: string | null | undefined;
    lotId?: string | null | undefined;
    invoiceId?: string | null | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"ajuste">;
    productId: z.ZodString;
    lotId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    delta: z.ZodEffects<z.ZodNumber, number, number>;
    reason: z.ZodEnum<["outro" | "contagem" | "perda" | "correcao" | "procedimento" | "venda" | "descarte_vencido" | "recebimento" | "transferencia_entrada" | "transferencia_saida" | "inventario_inicial", ...("outro" | "contagem" | "perda" | "correcao" | "procedimento" | "venda" | "descarte_vencido" | "recebimento" | "transferencia_entrada" | "transferencia_saida" | "inventario_inicial")[]]>;
    justification: z.ZodString;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    type: "ajuste";
    reason: "outro" | "contagem" | "perda" | "correcao" | "procedimento" | "venda" | "descarte_vencido" | "recebimento" | "transferencia_entrada" | "transferencia_saida" | "inventario_inicial";
    justification: string;
    productId: string;
    delta: number;
    notes?: string | null | undefined;
    lotId?: string | null | undefined;
}, {
    type: "ajuste";
    reason: "outro" | "contagem" | "perda" | "correcao" | "procedimento" | "venda" | "descarte_vencido" | "recebimento" | "transferencia_entrada" | "transferencia_saida" | "inventario_inicial";
    justification: string;
    productId: string;
    delta: number;
    notes?: string | null | undefined;
    lotId?: string | null | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"transferencia">;
    productId: z.ZodString;
    lotId: z.ZodString;
    quantity: z.ZodNumber;
    fromStorageLocationId: z.ZodString;
    toStorageLocationId: z.ZodString;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    type: "transferencia";
    quantity: number;
    productId: string;
    lotId: string;
    fromStorageLocationId: string;
    toStorageLocationId: string;
    notes?: string | null | undefined;
}, {
    type: "transferencia";
    quantity: number;
    productId: string;
    lotId: string;
    fromStorageLocationId: string;
    toStorageLocationId: string;
    notes?: string | null | undefined;
}>]>, {
    type: "entrada";
    reason: "outro" | "contagem" | "perda" | "correcao" | "procedimento" | "venda" | "descarte_vencido" | "recebimento" | "transferencia_entrada" | "transferencia_saida" | "inventario_inicial";
    quantity: number;
    productId: string;
    unitCost: number;
    lotNumber: string;
    acceptExpired: boolean;
    notes?: string | null | undefined;
    storageLocationId?: string | null | undefined;
    batchNumber?: string | null | undefined;
    expiryDate?: string | null | undefined;
    manufacturedDate?: string | null | undefined;
    supplierId?: string | null | undefined;
    purchaseOrderItemId?: string | null | undefined;
    acceptExpiredReason?: string | null | undefined;
} | {
    type: "saida";
    reason: "outro" | "contagem" | "perda" | "correcao" | "procedimento" | "venda" | "descarte_vencido" | "recebimento" | "transferencia_entrada" | "transferencia_saida" | "inventario_inicial";
    quantity: number;
    productId: string;
    notes?: string | null | undefined;
    justification?: string | undefined;
    encounterId?: string | null | undefined;
    lotId?: string | null | undefined;
    invoiceId?: string | null | undefined;
} | {
    type: "ajuste";
    reason: "outro" | "contagem" | "perda" | "correcao" | "procedimento" | "venda" | "descarte_vencido" | "recebimento" | "transferencia_entrada" | "transferencia_saida" | "inventario_inicial";
    justification: string;
    productId: string;
    delta: number;
    notes?: string | null | undefined;
    lotId?: string | null | undefined;
} | {
    type: "transferencia";
    quantity: number;
    productId: string;
    lotId: string;
    fromStorageLocationId: string;
    toStorageLocationId: string;
    notes?: string | null | undefined;
}, {
    type: "entrada";
    quantity: number;
    productId: string;
    unitCost: number;
    lotNumber: string;
    reason?: "outro" | "contagem" | "perda" | "correcao" | "procedimento" | "venda" | "descarte_vencido" | "recebimento" | "transferencia_entrada" | "transferencia_saida" | "inventario_inicial" | undefined;
    notes?: string | null | undefined;
    storageLocationId?: string | null | undefined;
    batchNumber?: string | null | undefined;
    expiryDate?: string | null | undefined;
    manufacturedDate?: string | null | undefined;
    supplierId?: string | null | undefined;
    purchaseOrderItemId?: string | null | undefined;
    acceptExpired?: boolean | undefined;
    acceptExpiredReason?: string | null | undefined;
} | {
    type: "saida";
    reason: "outro" | "contagem" | "perda" | "correcao" | "procedimento" | "venda" | "descarte_vencido" | "recebimento" | "transferencia_entrada" | "transferencia_saida" | "inventario_inicial";
    quantity: number;
    productId: string;
    notes?: string | null | undefined;
    justification?: string | undefined;
    encounterId?: string | null | undefined;
    lotId?: string | null | undefined;
    invoiceId?: string | null | undefined;
} | {
    type: "ajuste";
    reason: "outro" | "contagem" | "perda" | "correcao" | "procedimento" | "venda" | "descarte_vencido" | "recebimento" | "transferencia_entrada" | "transferencia_saida" | "inventario_inicial";
    justification: string;
    productId: string;
    delta: number;
    notes?: string | null | undefined;
    lotId?: string | null | undefined;
} | {
    type: "transferencia";
    quantity: number;
    productId: string;
    lotId: string;
    fromStorageLocationId: string;
    toStorageLocationId: string;
    notes?: string | null | undefined;
}>;
export type RegisterMovementInput = z.infer<typeof registerMovementSchema>;
export declare const listLotsSchema: z.ZodObject<{
    search: z.ZodOptional<z.ZodString>;
    productId: z.ZodOptional<z.ZodString>;
    categoryId: z.ZodOptional<z.ZodString>;
    storageLocationId: z.ZodOptional<z.ZodString>;
    statuses: z.ZodOptional<z.ZodArray<z.ZodEnum<["active", "consumed", "quarantined", "expired"]>, "many">>;
    alertLevel: z.ZodOptional<z.ZodEnum<["none", "warning", "critical"]>>;
    includeConsumed: z.ZodDefault<z.ZodBoolean>;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    includeConsumed: boolean;
    search?: string | undefined;
    productId?: string | undefined;
    categoryId?: string | undefined;
    statuses?: ("active" | "consumed" | "quarantined" | "expired")[] | undefined;
    storageLocationId?: string | undefined;
    alertLevel?: "none" | "warning" | "critical" | undefined;
}, {
    search?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    productId?: string | undefined;
    categoryId?: string | undefined;
    statuses?: ("active" | "consumed" | "quarantined" | "expired")[] | undefined;
    storageLocationId?: string | undefined;
    alertLevel?: "none" | "warning" | "critical" | undefined;
    includeConsumed?: boolean | undefined;
}>;
export type ListLotsInput = z.infer<typeof listLotsSchema>;
export declare const changeLotStatusSchema: z.ZodObject<{
    lotId: z.ZodString;
    status: z.ZodEnum<["active", "consumed", "quarantined", "expired"]>;
    justification: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "active" | "consumed" | "quarantined" | "expired";
    justification: string;
    lotId: string;
}, {
    status: "active" | "consumed" | "quarantined" | "expired";
    justification: string;
    lotId: string;
}>;
export type ChangeLotStatusInput = z.infer<typeof changeLotStatusSchema>;
export declare const quarantineLotSchema: z.ZodObject<{
    lotId: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    lotId: string;
}, {
    reason: string;
    lotId: string;
}>;
export type QuarantineLotInput = z.infer<typeof quarantineLotSchema>;
export declare const fefoSuggestionSchema: z.ZodObject<{
    productId: z.ZodString;
    quantity: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    quantity: number;
    productId: string;
}, {
    quantity: number;
    productId: string;
}>;
export type FefoSuggestionInput = z.infer<typeof fefoSuggestionSchema>;
export interface FefoSuggestionResult {
    available: boolean;
    totalAvailable: number;
    requested: number;
    shortage: number;
    lots: Array<{
        lotId: string;
        lotNumber: string;
        expiryDate: string | null;
        quantityAvailable: number;
        quantityFromLot: number;
    }>;
}
export declare const listAlertsSchema: z.ZodObject<{
    alertType: z.ZodOptional<z.ZodEnum<["lot_expiring", "low_stock", "critical_stock", "rupture"]>>;
    since: z.ZodOptional<z.ZodString>;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    alertType?: "lot_expiring" | "low_stock" | "critical_stock" | "rupture" | undefined;
    since?: string | undefined;
}, {
    page?: number | undefined;
    limit?: number | undefined;
    alertType?: "lot_expiring" | "low_stock" | "critical_stock" | "rupture" | undefined;
    since?: string | undefined;
}>;
export type ListAlertsInput = z.infer<typeof listAlertsSchema>;
export interface StockAlertEvent {
    type: 'stock.lot_expiring' | 'stock.low_alert' | 'stock.critical_alert' | 'stock.rupture';
    clinicId: string;
    productId: string;
    productName: string;
    lotId?: string;
    lotNumber?: string;
    expiryDate?: string | null;
    qtyRemaining: number;
    storageLocationId?: string | null;
    storageLocationName?: string | null;
    emittedAt: string;
}
/**
 * Monta a chave de idempotência para alert_emissions_log.
 * Formato: `{alert_type}:{entity_id}:{YYYY-MM-DD}` no timezone da clínica.
 * Um alerta por tipo/entidade/dia.
 */
export declare function buildAlertEmissionKey(alertType: AlertType, entityId: string, dateYmd: string): string;
//# sourceMappingURL=supply.schema.d.ts.map