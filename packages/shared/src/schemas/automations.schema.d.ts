import { z } from 'zod';
export declare const AUTOMATION_TRIGGERS: readonly ["appointment_24h_before", "appointment_2h_before", "appointment_created", "encounter_completed", "biopsy_result_received", "invoice_overdue_7d", "patient_birthday", "lead_no_response_48h", "lead_score_above_80"];
export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number];
export declare const automationTriggerSchema: z.ZodEnum<["appointment_24h_before", "appointment_2h_before", "appointment_created", "encounter_completed", "biopsy_result_received", "invoice_overdue_7d", "patient_birthday", "lead_no_response_48h", "lead_score_above_80"]>;
/** Metadados do trigger — documentação inline para guiar configuração no frontend. */
export declare const TRIGGER_META: Record<AutomationTrigger, {
    label: string;
    description: string;
    variables: string[];
    entityType: string;
}>;
export declare const AUTOMATION_CHANNELS: readonly ["whatsapp", "sms", "email"];
export type AutomationChannel = (typeof AUTOMATION_CHANNELS)[number];
export declare const automationChannelSchema: z.ZodEnum<["whatsapp", "sms", "email"]>;
/** Limite de caracteres por canal — exibido no editor de template. */
export declare const CHANNEL_CHAR_LIMITS: Record<AutomationChannel, number>;
export declare const TEMPLATE_VARIABLES: readonly ["{{nome_paciente}}", "{{data_consulta}}", "{{horario}}", "{{medico}}", "{{clinica}}", "{{telefone_clinica}}"];
export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];
/** Dados fictícios para preview — realistas em pt-BR. */
export declare const TEMPLATE_PREVIEW_DATA: Record<TemplateVariable, string>;
export declare const conditionOperatorSchema: z.ZodEnum<["eq", "neq", "gt", "lt", "gte", "lte", "in", "not_in", "exists", "not_exists"]>;
export declare const automationConditionSchema: z.ZodObject<{
    field: z.ZodString;
    operator: z.ZodEnum<["eq", "neq", "gt", "lt", "gte", "lte", "in", "not_in", "exists", "not_exists"]>;
    value: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodString, "many">]>>;
}, "strip", z.ZodTypeAny, {
    field: string;
    operator: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "in" | "not_in" | "exists" | "not_exists";
    value?: string | number | boolean | string[] | undefined;
}, {
    field: string;
    operator: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "in" | "not_in" | "exists" | "not_exists";
    value?: string | number | boolean | string[] | undefined;
}>;
export type AutomationCondition = z.infer<typeof automationConditionSchema>;
export declare const createAutomationSchema: z.ZodObject<{
    name: z.ZodString;
    trigger: z.ZodEnum<["appointment_24h_before", "appointment_2h_before", "appointment_created", "encounter_completed", "biopsy_result_received", "invoice_overdue_7d", "patient_birthday", "lead_no_response_48h", "lead_score_above_80"]>;
    templateId: z.ZodString;
    channelId: z.ZodString;
    delayMinutes: z.ZodDefault<z.ZodNumber>;
    conditions: z.ZodDefault<z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        operator: z.ZodEnum<["eq", "neq", "gt", "lt", "gte", "lte", "in", "not_in", "exists", "not_exists"]>;
        value: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodString, "many">]>>;
    }, "strip", z.ZodTypeAny, {
        field: string;
        operator: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "in" | "not_in" | "exists" | "not_exists";
        value?: string | number | boolean | string[] | undefined;
    }, {
        field: string;
        operator: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "in" | "not_in" | "exists" | "not_exists";
        value?: string | number | boolean | string[] | undefined;
    }>, "many">>;
    isActive: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    isActive: boolean;
    conditions: {
        field: string;
        operator: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "in" | "not_in" | "exists" | "not_exists";
        value?: string | number | boolean | string[] | undefined;
    }[];
    channelId: string;
    trigger: "appointment_24h_before" | "appointment_2h_before" | "appointment_created" | "encounter_completed" | "biopsy_result_received" | "invoice_overdue_7d" | "patient_birthday" | "lead_no_response_48h" | "lead_score_above_80";
    templateId: string;
    delayMinutes: number;
}, {
    name: string;
    channelId: string;
    trigger: "appointment_24h_before" | "appointment_2h_before" | "appointment_created" | "encounter_completed" | "biopsy_result_received" | "invoice_overdue_7d" | "patient_birthday" | "lead_no_response_48h" | "lead_score_above_80";
    templateId: string;
    isActive?: boolean | undefined;
    conditions?: {
        field: string;
        operator: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "in" | "not_in" | "exists" | "not_exists";
        value?: string | number | boolean | string[] | undefined;
    }[] | undefined;
    delayMinutes?: number | undefined;
}>;
export type CreateAutomationInput = z.infer<typeof createAutomationSchema>;
export declare const updateAutomationSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    templateId: z.ZodOptional<z.ZodString>;
    channelId: z.ZodOptional<z.ZodString>;
    delayMinutes: z.ZodOptional<z.ZodNumber>;
    conditions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        operator: z.ZodEnum<["eq", "neq", "gt", "lt", "gte", "lte", "in", "not_in", "exists", "not_exists"]>;
        value: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodString, "many">]>>;
    }, "strip", z.ZodTypeAny, {
        field: string;
        operator: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "in" | "not_in" | "exists" | "not_exists";
        value?: string | number | boolean | string[] | undefined;
    }, {
        field: string;
        operator: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "in" | "not_in" | "exists" | "not_exists";
        value?: string | number | boolean | string[] | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name?: string | undefined;
    conditions?: {
        field: string;
        operator: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "in" | "not_in" | "exists" | "not_exists";
        value?: string | number | boolean | string[] | undefined;
    }[] | undefined;
    channelId?: string | undefined;
    templateId?: string | undefined;
    delayMinutes?: number | undefined;
}, {
    id: string;
    name?: string | undefined;
    conditions?: {
        field: string;
        operator: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "in" | "not_in" | "exists" | "not_exists";
        value?: string | number | boolean | string[] | undefined;
    }[] | undefined;
    channelId?: string | undefined;
    templateId?: string | undefined;
    delayMinutes?: number | undefined;
}>;
export type UpdateAutomationInput = z.infer<typeof updateAutomationSchema>;
export declare const toggleAutomationSchema: z.ZodObject<{
    id: z.ZodString;
    isActive: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    id: string;
    isActive: boolean;
}, {
    id: string;
    isActive: boolean;
}>;
export type ToggleAutomationInput = z.infer<typeof toggleAutomationSchema>;
export declare const listAutomationsSchema: z.ZodObject<{
    trigger: z.ZodOptional<z.ZodEnum<["appointment_24h_before", "appointment_2h_before", "appointment_created", "encounter_completed", "biopsy_result_received", "invoice_overdue_7d", "patient_birthday", "lead_no_response_48h", "lead_score_above_80"]>>;
    channel: z.ZodOptional<z.ZodEnum<["whatsapp", "sms", "email"]>>;
    isActive: z.ZodOptional<z.ZodBoolean>;
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    channel?: "email" | "whatsapp" | "sms" | undefined;
    cursor?: string | undefined;
    isActive?: boolean | undefined;
    trigger?: "appointment_24h_before" | "appointment_2h_before" | "appointment_created" | "encounter_completed" | "biopsy_result_received" | "invoice_overdue_7d" | "patient_birthday" | "lead_no_response_48h" | "lead_score_above_80" | undefined;
}, {
    limit?: number | undefined;
    channel?: "email" | "whatsapp" | "sms" | undefined;
    cursor?: string | undefined;
    isActive?: boolean | undefined;
    trigger?: "appointment_24h_before" | "appointment_2h_before" | "appointment_created" | "encounter_completed" | "biopsy_result_received" | "invoice_overdue_7d" | "patient_birthday" | "lead_no_response_48h" | "lead_score_above_80" | undefined;
}>;
export type ListAutomationsInput = z.infer<typeof listAutomationsSchema>;
export declare const listExecutionLogSchema: z.ZodObject<{
    automationId: z.ZodString;
    status: z.ZodOptional<z.ZodEnum<["processing", "sent", "skipped", "failed"]>>;
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    automationId: string;
    status?: "processing" | "failed" | "sent" | "skipped" | undefined;
    cursor?: string | undefined;
}, {
    automationId: string;
    status?: "processing" | "failed" | "sent" | "skipped" | undefined;
    limit?: number | undefined;
    cursor?: string | undefined;
}>;
export type ListExecutionLogInput = z.infer<typeof listExecutionLogSchema>;
export declare const createTemplateSchema: z.ZodObject<{
    name: z.ZodString;
    channel: z.ZodEnum<["whatsapp", "sms", "email"]>;
    body: z.ZodString;
    bodyHtml: z.ZodOptional<z.ZodString>;
    subject: z.ZodOptional<z.ZodString>;
    metaHsmId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    channel: "email" | "whatsapp" | "sms";
    body: string;
    bodyHtml?: string | undefined;
    subject?: string | undefined;
    metaHsmId?: string | undefined;
}, {
    name: string;
    channel: "email" | "whatsapp" | "sms";
    body: string;
    bodyHtml?: string | undefined;
    subject?: string | undefined;
    metaHsmId?: string | undefined;
}>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export declare const updateTemplateSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    body: z.ZodOptional<z.ZodString>;
    bodyHtml: z.ZodOptional<z.ZodString>;
    subject: z.ZodOptional<z.ZodString>;
    metaHsmId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name?: string | undefined;
    body?: string | undefined;
    bodyHtml?: string | undefined;
    subject?: string | undefined;
    metaHsmId?: string | undefined;
}, {
    id: string;
    name?: string | undefined;
    body?: string | undefined;
    bodyHtml?: string | undefined;
    subject?: string | undefined;
    metaHsmId?: string | undefined;
}>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export declare const listTemplatesSchema: z.ZodObject<{
    channel: z.ZodOptional<z.ZodEnum<["whatsapp", "sms", "email"]>>;
    search: z.ZodOptional<z.ZodString>;
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    search?: string | undefined;
    channel?: "email" | "whatsapp" | "sms" | undefined;
    cursor?: string | undefined;
}, {
    search?: string | undefined;
    limit?: number | undefined;
    channel?: "email" | "whatsapp" | "sms" | undefined;
    cursor?: string | undefined;
}>;
export type ListTemplatesInput = z.infer<typeof listTemplatesSchema>;
export declare const previewTemplateSchema: z.ZodObject<{
    body: z.ZodString;
}, "strip", z.ZodTypeAny, {
    body: string;
}, {
    body: string;
}>;
export type PreviewTemplateInput = z.infer<typeof previewTemplateSchema>;
//# sourceMappingURL=automations.schema.d.ts.map