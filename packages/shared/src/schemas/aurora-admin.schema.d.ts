/**
 * Schemas da Aurora — painel de gestão (Fase 4).
 *
 * Contratos validados tanto no backend (tRPC + Fastify) quanto no frontend
 * (react-hook-form). Mantidos em `@dermaos/shared` para que ambos compartilhem
 * exatamente a mesma definição.
 *
 * Referências:
 *   - Anexo A §A.1.2 — modelos `AiAgent`, `AiKnowledgeBase`, `Channel`
 *   - Anexo B §B.1   — taxonomia de intenções e tools
 *   - Prompt Fase 4  — §1.1, §1.2, §1.3, §1.4, §3.5
 */
import { z } from 'zod';
import { channelTypeSchema } from './omni.schema';
export declare const aiAgentTypeSchema: z.ZodEnum<["receptionist", "scheduler", "follow_up", "support", "custom"]>;
export type AiAgentType = z.infer<typeof aiAgentTypeSchema>;
export declare const aiAgentModelSchema: z.ZodEnum<["claude-haiku-4-5", "claude-sonnet-4-20250514", "ollama:llama3.1:8b"]>;
export type AiAgentModel = z.infer<typeof aiAgentModelSchema>;
export declare const aiAgentToolSchema: z.ZodEnum<["consultarHorarios", "reservarSlot", "confirmarAgendamento", "cancelarAgendamento", "buscarAppointmentDoContato", "consultarKnowledgeBase", "transferirParaHumano"]>;
export type AiAgentTool = z.infer<typeof aiAgentToolSchema>;
export declare const auroraIntentSchema: z.ZodEnum<["saudacao", "agendar_consulta", "remarcar_consulta", "cancelar_consulta", "confirmar_consulta", "consultar_horarios", "informacoes_clinica", "duvida_procedimento", "pos_atendimento", "emergencia", "fora_de_escopo"]>;
export type AuroraIntent = z.infer<typeof auroraIntentSchema>;
export declare const embeddingStatusSchema: z.ZodEnum<["pending", "processing", "completed", "failed"]>;
export type EmbeddingStatus = z.infer<typeof embeddingStatusSchema>;
export declare const operatingHoursSchema: z.ZodDefault<z.ZodObject<{
    'mon-fri': z.ZodOptional<z.ZodNullable<z.ZodString>>;
    mon: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    tue: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    wed: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    thu: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    fri: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    sat: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    sun: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strict", z.ZodTypeAny, {
    'mon-fri'?: string | null | undefined;
    mon?: string | null | undefined;
    tue?: string | null | undefined;
    wed?: string | null | undefined;
    thu?: string | null | undefined;
    fri?: string | null | undefined;
    sat?: string | null | undefined;
    sun?: string | null | undefined;
}, {
    'mon-fri'?: string | null | undefined;
    mon?: string | null | undefined;
    tue?: string | null | undefined;
    wed?: string | null | undefined;
    thu?: string | null | undefined;
    fri?: string | null | undefined;
    sat?: string | null | undefined;
    sun?: string | null | undefined;
}>>;
export type OperatingHours = z.infer<typeof operatingHoursSchema>;
export declare const escalationConditionSchema: z.ZodObject<{
    type: z.ZodEnum<["sentiment", "intent", "keyword", "time_of_day", "unresolved_messages"]>;
    operator: z.ZodEnum<["equals", "not_equals", "contains", "greater_than"]>;
    value: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
}, "strip", z.ZodTypeAny, {
    value: string | number;
    type: "sentiment" | "intent" | "keyword" | "time_of_day" | "unresolved_messages";
    operator: "equals" | "not_equals" | "contains" | "greater_than";
}, {
    value: string | number;
    type: "sentiment" | "intent" | "keyword" | "time_of_day" | "unresolved_messages";
    operator: "equals" | "not_equals" | "contains" | "greater_than";
}>;
export type EscalationCondition = z.infer<typeof escalationConditionSchema>;
export declare const escalationActionSchema: z.ZodObject<{
    type: z.ZodEnum<["escalate_to_role", "mark_urgent", "notify_internal"]>;
    target_role: z.ZodOptional<z.ZodEnum<["receptionist", "dermatologist", "admin"]>>;
    notify_channel: z.ZodOptional<z.ZodEnum<["socket", "email"]>>;
}, "strip", z.ZodTypeAny, {
    type: "escalate_to_role" | "mark_urgent" | "notify_internal";
    target_role?: "admin" | "dermatologist" | "receptionist" | undefined;
    notify_channel?: "email" | "socket" | undefined;
}, {
    type: "escalate_to_role" | "mark_urgent" | "notify_internal";
    target_role?: "admin" | "dermatologist" | "receptionist" | undefined;
    notify_channel?: "email" | "socket" | undefined;
}>;
export type EscalationAction = z.infer<typeof escalationActionSchema>;
export declare const escalationRuleSchema: z.ZodObject<{
    id: z.ZodString;
    priority: z.ZodNumber;
    name: z.ZodString;
    isActive: z.ZodDefault<z.ZodBoolean>;
    conditions: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["sentiment", "intent", "keyword", "time_of_day", "unresolved_messages"]>;
        operator: z.ZodEnum<["equals", "not_equals", "contains", "greater_than"]>;
        value: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
    }, "strip", z.ZodTypeAny, {
        value: string | number;
        type: "sentiment" | "intent" | "keyword" | "time_of_day" | "unresolved_messages";
        operator: "equals" | "not_equals" | "contains" | "greater_than";
    }, {
        value: string | number;
        type: "sentiment" | "intent" | "keyword" | "time_of_day" | "unresolved_messages";
        operator: "equals" | "not_equals" | "contains" | "greater_than";
    }>, "many">;
    action: z.ZodObject<{
        type: z.ZodEnum<["escalate_to_role", "mark_urgent", "notify_internal"]>;
        target_role: z.ZodOptional<z.ZodEnum<["receptionist", "dermatologist", "admin"]>>;
        notify_channel: z.ZodOptional<z.ZodEnum<["socket", "email"]>>;
    }, "strip", z.ZodTypeAny, {
        type: "escalate_to_role" | "mark_urgent" | "notify_internal";
        target_role?: "admin" | "dermatologist" | "receptionist" | undefined;
        notify_channel?: "email" | "socket" | undefined;
    }, {
        type: "escalate_to_role" | "mark_urgent" | "notify_internal";
        target_role?: "admin" | "dermatologist" | "receptionist" | undefined;
        notify_channel?: "email" | "socket" | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    action: {
        type: "escalate_to_role" | "mark_urgent" | "notify_internal";
        target_role?: "admin" | "dermatologist" | "receptionist" | undefined;
        notify_channel?: "email" | "socket" | undefined;
    };
    priority: number;
    isActive: boolean;
    conditions: {
        value: string | number;
        type: "sentiment" | "intent" | "keyword" | "time_of_day" | "unresolved_messages";
        operator: "equals" | "not_equals" | "contains" | "greater_than";
    }[];
}, {
    name: string;
    id: string;
    action: {
        type: "escalate_to_role" | "mark_urgent" | "notify_internal";
        target_role?: "admin" | "dermatologist" | "receptionist" | undefined;
        notify_channel?: "email" | "socket" | undefined;
    };
    priority: number;
    conditions: {
        value: string | number;
        type: "sentiment" | "intent" | "keyword" | "time_of_day" | "unresolved_messages";
        operator: "equals" | "not_equals" | "contains" | "greater_than";
    }[];
    isActive?: boolean | undefined;
}>;
export type EscalationRule = z.infer<typeof escalationRuleSchema>;
export declare const aiAgentConfigSchema: z.ZodObject<{
    operating_hours: z.ZodOptional<z.ZodDefault<z.ZodObject<{
        'mon-fri': z.ZodOptional<z.ZodNullable<z.ZodString>>;
        mon: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        tue: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        wed: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        thu: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        fri: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        sat: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        sun: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strict", z.ZodTypeAny, {
        'mon-fri'?: string | null | undefined;
        mon?: string | null | undefined;
        tue?: string | null | undefined;
        wed?: string | null | undefined;
        thu?: string | null | undefined;
        fri?: string | null | undefined;
        sat?: string | null | undefined;
        sun?: string | null | undefined;
    }, {
        'mon-fri'?: string | null | undefined;
        mon?: string | null | undefined;
        tue?: string | null | undefined;
        wed?: string | null | undefined;
        thu?: string | null | undefined;
        fri?: string | null | undefined;
        sat?: string | null | undefined;
        sun?: string | null | undefined;
    }>>>;
    escalation_rules: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        priority: z.ZodNumber;
        name: z.ZodString;
        isActive: z.ZodDefault<z.ZodBoolean>;
        conditions: z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<["sentiment", "intent", "keyword", "time_of_day", "unresolved_messages"]>;
            operator: z.ZodEnum<["equals", "not_equals", "contains", "greater_than"]>;
            value: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
        }, "strip", z.ZodTypeAny, {
            value: string | number;
            type: "sentiment" | "intent" | "keyword" | "time_of_day" | "unresolved_messages";
            operator: "equals" | "not_equals" | "contains" | "greater_than";
        }, {
            value: string | number;
            type: "sentiment" | "intent" | "keyword" | "time_of_day" | "unresolved_messages";
            operator: "equals" | "not_equals" | "contains" | "greater_than";
        }>, "many">;
        action: z.ZodObject<{
            type: z.ZodEnum<["escalate_to_role", "mark_urgent", "notify_internal"]>;
            target_role: z.ZodOptional<z.ZodEnum<["receptionist", "dermatologist", "admin"]>>;
            notify_channel: z.ZodOptional<z.ZodEnum<["socket", "email"]>>;
        }, "strip", z.ZodTypeAny, {
            type: "escalate_to_role" | "mark_urgent" | "notify_internal";
            target_role?: "admin" | "dermatologist" | "receptionist" | undefined;
            notify_channel?: "email" | "socket" | undefined;
        }, {
            type: "escalate_to_role" | "mark_urgent" | "notify_internal";
            target_role?: "admin" | "dermatologist" | "receptionist" | undefined;
            notify_channel?: "email" | "socket" | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        action: {
            type: "escalate_to_role" | "mark_urgent" | "notify_internal";
            target_role?: "admin" | "dermatologist" | "receptionist" | undefined;
            notify_channel?: "email" | "socket" | undefined;
        };
        priority: number;
        isActive: boolean;
        conditions: {
            value: string | number;
            type: "sentiment" | "intent" | "keyword" | "time_of_day" | "unresolved_messages";
            operator: "equals" | "not_equals" | "contains" | "greater_than";
        }[];
    }, {
        name: string;
        id: string;
        action: {
            type: "escalate_to_role" | "mark_urgent" | "notify_internal";
            target_role?: "admin" | "dermatologist" | "receptionist" | undefined;
            notify_channel?: "email" | "socket" | undefined;
        };
        priority: number;
        conditions: {
            value: string | number;
            type: "sentiment" | "intent" | "keyword" | "time_of_day" | "unresolved_messages";
            operator: "equals" | "not_equals" | "contains" | "greater_than";
        }[];
        isActive?: boolean | undefined;
    }>, "many">>;
    /** SLA em minutos para resposta humana após escalar. */
    sla_minutes: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    escalation_rules: {
        name: string;
        id: string;
        action: {
            type: "escalate_to_role" | "mark_urgent" | "notify_internal";
            target_role?: "admin" | "dermatologist" | "receptionist" | undefined;
            notify_channel?: "email" | "socket" | undefined;
        };
        priority: number;
        isActive: boolean;
        conditions: {
            value: string | number;
            type: "sentiment" | "intent" | "keyword" | "time_of_day" | "unresolved_messages";
            operator: "equals" | "not_equals" | "contains" | "greater_than";
        }[];
    }[];
    operating_hours?: {
        'mon-fri'?: string | null | undefined;
        mon?: string | null | undefined;
        tue?: string | null | undefined;
        wed?: string | null | undefined;
        thu?: string | null | undefined;
        fri?: string | null | undefined;
        sat?: string | null | undefined;
        sun?: string | null | undefined;
    } | undefined;
    sla_minutes?: number | undefined;
}, {
    operating_hours?: {
        'mon-fri'?: string | null | undefined;
        mon?: string | null | undefined;
        tue?: string | null | undefined;
        wed?: string | null | undefined;
        thu?: string | null | undefined;
        fri?: string | null | undefined;
        sat?: string | null | undefined;
        sun?: string | null | undefined;
    } | undefined;
    escalation_rules?: {
        name: string;
        id: string;
        action: {
            type: "escalate_to_role" | "mark_urgent" | "notify_internal";
            target_role?: "admin" | "dermatologist" | "receptionist" | undefined;
            notify_channel?: "email" | "socket" | undefined;
        };
        priority: number;
        conditions: {
            value: string | number;
            type: "sentiment" | "intent" | "keyword" | "time_of_day" | "unresolved_messages";
            operator: "equals" | "not_equals" | "contains" | "greater_than";
        }[];
        isActive?: boolean | undefined;
    }[] | undefined;
    sla_minutes?: number | undefined;
}>;
export type AiAgentConfig = z.infer<typeof aiAgentConfigSchema>;
export declare const createAgentSchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodEnum<["receptionist", "scheduler", "follow_up", "support", "custom"]>;
    model: z.ZodEnum<["claude-haiku-4-5", "claude-sonnet-4-20250514", "ollama:llama3.1:8b"]>;
    systemPrompt: z.ZodOptional<z.ZodString>;
    temperature: z.ZodDefault<z.ZodNumber>;
    maxTokens: z.ZodDefault<z.ZodNumber>;
    toolsEnabled: z.ZodDefault<z.ZodArray<z.ZodEnum<["consultarHorarios", "reservarSlot", "confirmarAgendamento", "cancelarAgendamento", "buscarAppointmentDoContato", "consultarKnowledgeBase", "transferirParaHumano"]>, "many">>;
    config: z.ZodOptional<z.ZodObject<{
        operating_hours: z.ZodOptional<z.ZodDefault<z.ZodObject<{
            'mon-fri': z.ZodOptional<z.ZodNullable<z.ZodString>>;
            mon: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            tue: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            wed: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            thu: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            fri: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            sat: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            sun: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strict", z.ZodTypeAny, {
            'mon-fri'?: string | null | undefined;
            mon?: string | null | undefined;
            tue?: string | null | undefined;
            wed?: string | null | undefined;
            thu?: string | null | undefined;
            fri?: string | null | undefined;
            sat?: string | null | undefined;
            sun?: string | null | undefined;
        }, {
            'mon-fri'?: string | null | undefined;
            mon?: string | null | undefined;
            tue?: string | null | undefined;
            wed?: string | null | undefined;
            thu?: string | null | undefined;
            fri?: string | null | undefined;
            sat?: string | null | undefined;
            sun?: string | null | undefined;
        }>>>;
        escalation_rules: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            priority: z.ZodNumber;
            name: z.ZodString;
            isActive: z.ZodDefault<z.ZodBoolean>;
            conditions: z.ZodArray<z.ZodObject<{
                type: z.ZodEnum<["sentiment", "intent", "keyword", "time_of_day", "unresolved_messages"]>;
                operator: z.ZodEnum<["equals", "not_equals", "contains", "greater_than"]>;
                value: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
            }, "strip", z.ZodTypeAny, {
                value: string | number;
                type: "sentiment" | "intent" | "keyword" | "time_of_day" | "unresolved_messages";
                operator: "equals" | "not_equals" | "contains" | "greater_than";
            }, {
                value: string | number;
                type: "sentiment" | "intent" | "keyword" | "time_of_day" | "unresolved_messages";
                operator: "equals" | "not_equals" | "contains" | "greater_than";
            }>, "many">;
            action: z.ZodObject<{
                type: z.ZodEnum<["escalate_to_role", "mark_urgent", "notify_internal"]>;
                target_role: z.ZodOptional<z.ZodEnum<["receptionist", "dermatologist", "admin"]>>;
                notify_channel: z.ZodOptional<z.ZodEnum<["socket", "email"]>>;
            }, "strip", z.ZodTypeAny, {
                type: "escalate_to_role" | "mark_urgent" | "notify_internal";
                target_role?: "admin" | "dermatologist" | "receptionist" | undefined;
                notify_channel?: "email" | "socket" | undefined;
            }, {
                type: "escalate_to_role" | "mark_urgent" | "notify_internal";
                target_role?: "admin" | "dermatologist" | "receptionist" | undefined;
                notify_channel?: "email" | "socket" | undefined;
            }>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            id: string;
            action: {
                type: "escalate_to_role" | "mark_urgent" | "notify_internal";
                target_role?: "admin" | "dermatologist" | "receptionist" | undefined;
                notify_channel?: "email" | "socket" | undefined;
            };
            priority: number;
            isActive: boolean;
            conditions: {
                value: string | number;
                type: "sentiment" | "intent" | "keyword" | "time_of_day" | "unresolved_messages";
                operator: "equals" | "not_equals" | "contains" | "greater_than";
            }[];
        }, {
            name: string;
            id: string;
            action: {
                type: "escalate_to_role" | "mark_urgent" | "notify_internal";
                target_role?: "admin" | "dermatologist" | "receptionist" | undefined;
                notify_channel?: "email" | "socket" | undefined;
            };
            priority: number;
            conditions: {
                value: string | number;
                type: "sentiment" | "intent" | "keyword" | "time_of_day" | "unresolved_messages";
                operator: "equals" | "not_equals" | "contains" | "greater_than";
            }[];
            isActive?: boolean | undefined;
        }>, "many">>;
        /** SLA em minutos para resposta humana após escalar. */
        sla_minutes: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        escalation_rules: {
            name: string;
            id: string;
            action: {
                type: "escalate_to_role" | "mark_urgent" | "notify_internal";
                target_role?: "admin" | "dermatologist" | "receptionist" | undefined;
                notify_channel?: "email" | "socket" | undefined;
            };
            priority: number;
            isActive: boolean;
            conditions: {
                value: string | number;
                type: "sentiment" | "intent" | "keyword" | "time_of_day" | "unresolved_messages";
                operator: "equals" | "not_equals" | "contains" | "greater_than";
            }[];
        }[];
        operating_hours?: {
            'mon-fri'?: string | null | undefined;
            mon?: string | null | undefined;
            tue?: string | null | undefined;
            wed?: string | null | undefined;
            thu?: string | null | undefined;
            fri?: string | null | undefined;
            sat?: string | null | undefined;
            sun?: string | null | undefined;
        } | undefined;
        sla_minutes?: number | undefined;
    }, {
        operating_hours?: {
            'mon-fri'?: string | null | undefined;
            mon?: string | null | undefined;
            tue?: string | null | undefined;
            wed?: string | null | undefined;
            thu?: string | null | undefined;
            fri?: string | null | undefined;
            sat?: string | null | undefined;
            sun?: string | null | undefined;
        } | undefined;
        escalation_rules?: {
            name: string;
            id: string;
            action: {
                type: "escalate_to_role" | "mark_urgent" | "notify_internal";
                target_role?: "admin" | "dermatologist" | "receptionist" | undefined;
                notify_channel?: "email" | "socket" | undefined;
            };
            priority: number;
            conditions: {
                value: string | number;
                type: "sentiment" | "intent" | "keyword" | "time_of_day" | "unresolved_messages";
                operator: "equals" | "not_equals" | "contains" | "greater_than";
            }[];
            isActive?: boolean | undefined;
        }[] | undefined;
        sla_minutes?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    type: "custom" | "receptionist" | "scheduler" | "follow_up" | "support";
    name: string;
    model: "claude-haiku-4-5" | "claude-sonnet-4-20250514" | "ollama:llama3.1:8b";
    temperature: number;
    maxTokens: number;
    toolsEnabled: ("consultarHorarios" | "reservarSlot" | "confirmarAgendamento" | "cancelarAgendamento" | "buscarAppointmentDoContato" | "consultarKnowledgeBase" | "transferirParaHumano")[];
    config?: {
        escalation_rules: {
            name: string;
            id: string;
            action: {
                type: "escalate_to_role" | "mark_urgent" | "notify_internal";
                target_role?: "admin" | "dermatologist" | "receptionist" | undefined;
                notify_channel?: "email" | "socket" | undefined;
            };
            priority: number;
            isActive: boolean;
            conditions: {
                value: string | number;
                type: "sentiment" | "intent" | "keyword" | "time_of_day" | "unresolved_messages";
                operator: "equals" | "not_equals" | "contains" | "greater_than";
            }[];
        }[];
        operating_hours?: {
            'mon-fri'?: string | null | undefined;
            mon?: string | null | undefined;
            tue?: string | null | undefined;
            wed?: string | null | undefined;
            thu?: string | null | undefined;
            fri?: string | null | undefined;
            sat?: string | null | undefined;
            sun?: string | null | undefined;
        } | undefined;
        sla_minutes?: number | undefined;
    } | undefined;
    systemPrompt?: string | undefined;
}, {
    type: "custom" | "receptionist" | "scheduler" | "follow_up" | "support";
    name: string;
    model: "claude-haiku-4-5" | "claude-sonnet-4-20250514" | "ollama:llama3.1:8b";
    config?: {
        operating_hours?: {
            'mon-fri'?: string | null | undefined;
            mon?: string | null | undefined;
            tue?: string | null | undefined;
            wed?: string | null | undefined;
            thu?: string | null | undefined;
            fri?: string | null | undefined;
            sat?: string | null | undefined;
            sun?: string | null | undefined;
        } | undefined;
        escalation_rules?: {
            name: string;
            id: string;
            action: {
                type: "escalate_to_role" | "mark_urgent" | "notify_internal";
                target_role?: "admin" | "dermatologist" | "receptionist" | undefined;
                notify_channel?: "email" | "socket" | undefined;
            };
            priority: number;
            conditions: {
                value: string | number;
                type: "sentiment" | "intent" | "keyword" | "time_of_day" | "unresolved_messages";
                operator: "equals" | "not_equals" | "contains" | "greater_than";
            }[];
            isActive?: boolean | undefined;
        }[] | undefined;
        sla_minutes?: number | undefined;
    } | undefined;
    systemPrompt?: string | undefined;
    temperature?: number | undefined;
    maxTokens?: number | undefined;
    toolsEnabled?: ("consultarHorarios" | "reservarSlot" | "confirmarAgendamento" | "cancelarAgendamento" | "buscarAppointmentDoContato" | "consultarKnowledgeBase" | "transferirParaHumano")[] | undefined;
}>;
export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export declare const updateAgentSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<["receptionist", "scheduler", "follow_up", "support", "custom"]>>;
    model: z.ZodOptional<z.ZodEnum<["claude-haiku-4-5", "claude-sonnet-4-20250514", "ollama:llama3.1:8b"]>>;
    systemPrompt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    temperature: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    maxTokens: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    toolsEnabled: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodEnum<["consultarHorarios", "reservarSlot", "confirmarAgendamento", "cancelarAgendamento", "buscarAppointmentDoContato", "consultarKnowledgeBase", "transferirParaHumano"]>, "many">>>;
    config: z.ZodOptional<z.ZodOptional<z.ZodObject<{
        operating_hours: z.ZodOptional<z.ZodDefault<z.ZodObject<{
            'mon-fri': z.ZodOptional<z.ZodNullable<z.ZodString>>;
            mon: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            tue: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            wed: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            thu: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            fri: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            sat: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            sun: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strict", z.ZodTypeAny, {
            'mon-fri'?: string | null | undefined;
            mon?: string | null | undefined;
            tue?: string | null | undefined;
            wed?: string | null | undefined;
            thu?: string | null | undefined;
            fri?: string | null | undefined;
            sat?: string | null | undefined;
            sun?: string | null | undefined;
        }, {
            'mon-fri'?: string | null | undefined;
            mon?: string | null | undefined;
            tue?: string | null | undefined;
            wed?: string | null | undefined;
            thu?: string | null | undefined;
            fri?: string | null | undefined;
            sat?: string | null | undefined;
            sun?: string | null | undefined;
        }>>>;
        escalation_rules: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            priority: z.ZodNumber;
            name: z.ZodString;
            isActive: z.ZodDefault<z.ZodBoolean>;
            conditions: z.ZodArray<z.ZodObject<{
                type: z.ZodEnum<["sentiment", "intent", "keyword", "time_of_day", "unresolved_messages"]>;
                operator: z.ZodEnum<["equals", "not_equals", "contains", "greater_than"]>;
                value: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
            }, "strip", z.ZodTypeAny, {
                value: string | number;
                type: "sentiment" | "intent" | "keyword" | "time_of_day" | "unresolved_messages";
                operator: "equals" | "not_equals" | "contains" | "greater_than";
            }, {
                value: string | number;
                type: "sentiment" | "intent" | "keyword" | "time_of_day" | "unresolved_messages";
                operator: "equals" | "not_equals" | "contains" | "greater_than";
            }>, "many">;
            action: z.ZodObject<{
                type: z.ZodEnum<["escalate_to_role", "mark_urgent", "notify_internal"]>;
                target_role: z.ZodOptional<z.ZodEnum<["receptionist", "dermatologist", "admin"]>>;
                notify_channel: z.ZodOptional<z.ZodEnum<["socket", "email"]>>;
            }, "strip", z.ZodTypeAny, {
                type: "escalate_to_role" | "mark_urgent" | "notify_internal";
                target_role?: "admin" | "dermatologist" | "receptionist" | undefined;
                notify_channel?: "email" | "socket" | undefined;
            }, {
                type: "escalate_to_role" | "mark_urgent" | "notify_internal";
                target_role?: "admin" | "dermatologist" | "receptionist" | undefined;
                notify_channel?: "email" | "socket" | undefined;
            }>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            id: string;
            action: {
                type: "escalate_to_role" | "mark_urgent" | "notify_internal";
                target_role?: "admin" | "dermatologist" | "receptionist" | undefined;
                notify_channel?: "email" | "socket" | undefined;
            };
            priority: number;
            isActive: boolean;
            conditions: {
                value: string | number;
                type: "sentiment" | "intent" | "keyword" | "time_of_day" | "unresolved_messages";
                operator: "equals" | "not_equals" | "contains" | "greater_than";
            }[];
        }, {
            name: string;
            id: string;
            action: {
                type: "escalate_to_role" | "mark_urgent" | "notify_internal";
                target_role?: "admin" | "dermatologist" | "receptionist" | undefined;
                notify_channel?: "email" | "socket" | undefined;
            };
            priority: number;
            conditions: {
                value: string | number;
                type: "sentiment" | "intent" | "keyword" | "time_of_day" | "unresolved_messages";
                operator: "equals" | "not_equals" | "contains" | "greater_than";
            }[];
            isActive?: boolean | undefined;
        }>, "many">>;
        /** SLA em minutos para resposta humana após escalar. */
        sla_minutes: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        escalation_rules: {
            name: string;
            id: string;
            action: {
                type: "escalate_to_role" | "mark_urgent" | "notify_internal";
                target_role?: "admin" | "dermatologist" | "receptionist" | undefined;
                notify_channel?: "email" | "socket" | undefined;
            };
            priority: number;
            isActive: boolean;
            conditions: {
                value: string | number;
                type: "sentiment" | "intent" | "keyword" | "time_of_day" | "unresolved_messages";
                operator: "equals" | "not_equals" | "contains" | "greater_than";
            }[];
        }[];
        operating_hours?: {
            'mon-fri'?: string | null | undefined;
            mon?: string | null | undefined;
            tue?: string | null | undefined;
            wed?: string | null | undefined;
            thu?: string | null | undefined;
            fri?: string | null | undefined;
            sat?: string | null | undefined;
            sun?: string | null | undefined;
        } | undefined;
        sla_minutes?: number | undefined;
    }, {
        operating_hours?: {
            'mon-fri'?: string | null | undefined;
            mon?: string | null | undefined;
            tue?: string | null | undefined;
            wed?: string | null | undefined;
            thu?: string | null | undefined;
            fri?: string | null | undefined;
            sat?: string | null | undefined;
            sun?: string | null | undefined;
        } | undefined;
        escalation_rules?: {
            name: string;
            id: string;
            action: {
                type: "escalate_to_role" | "mark_urgent" | "notify_internal";
                target_role?: "admin" | "dermatologist" | "receptionist" | undefined;
                notify_channel?: "email" | "socket" | undefined;
            };
            priority: number;
            conditions: {
                value: string | number;
                type: "sentiment" | "intent" | "keyword" | "time_of_day" | "unresolved_messages";
                operator: "equals" | "not_equals" | "contains" | "greater_than";
            }[];
            isActive?: boolean | undefined;
        }[] | undefined;
        sla_minutes?: number | undefined;
    }>>>;
} & {
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    type?: "custom" | "receptionist" | "scheduler" | "follow_up" | "support" | undefined;
    name?: string | undefined;
    config?: {
        escalation_rules: {
            name: string;
            id: string;
            action: {
                type: "escalate_to_role" | "mark_urgent" | "notify_internal";
                target_role?: "admin" | "dermatologist" | "receptionist" | undefined;
                notify_channel?: "email" | "socket" | undefined;
            };
            priority: number;
            isActive: boolean;
            conditions: {
                value: string | number;
                type: "sentiment" | "intent" | "keyword" | "time_of_day" | "unresolved_messages";
                operator: "equals" | "not_equals" | "contains" | "greater_than";
            }[];
        }[];
        operating_hours?: {
            'mon-fri'?: string | null | undefined;
            mon?: string | null | undefined;
            tue?: string | null | undefined;
            wed?: string | null | undefined;
            thu?: string | null | undefined;
            fri?: string | null | undefined;
            sat?: string | null | undefined;
            sun?: string | null | undefined;
        } | undefined;
        sla_minutes?: number | undefined;
    } | undefined;
    model?: "claude-haiku-4-5" | "claude-sonnet-4-20250514" | "ollama:llama3.1:8b" | undefined;
    systemPrompt?: string | undefined;
    temperature?: number | undefined;
    maxTokens?: number | undefined;
    toolsEnabled?: ("consultarHorarios" | "reservarSlot" | "confirmarAgendamento" | "cancelarAgendamento" | "buscarAppointmentDoContato" | "consultarKnowledgeBase" | "transferirParaHumano")[] | undefined;
}, {
    id: string;
    type?: "custom" | "receptionist" | "scheduler" | "follow_up" | "support" | undefined;
    name?: string | undefined;
    config?: {
        operating_hours?: {
            'mon-fri'?: string | null | undefined;
            mon?: string | null | undefined;
            tue?: string | null | undefined;
            wed?: string | null | undefined;
            thu?: string | null | undefined;
            fri?: string | null | undefined;
            sat?: string | null | undefined;
            sun?: string | null | undefined;
        } | undefined;
        escalation_rules?: {
            name: string;
            id: string;
            action: {
                type: "escalate_to_role" | "mark_urgent" | "notify_internal";
                target_role?: "admin" | "dermatologist" | "receptionist" | undefined;
                notify_channel?: "email" | "socket" | undefined;
            };
            priority: number;
            conditions: {
                value: string | number;
                type: "sentiment" | "intent" | "keyword" | "time_of_day" | "unresolved_messages";
                operator: "equals" | "not_equals" | "contains" | "greater_than";
            }[];
            isActive?: boolean | undefined;
        }[] | undefined;
        sla_minutes?: number | undefined;
    } | undefined;
    model?: "claude-haiku-4-5" | "claude-sonnet-4-20250514" | "ollama:llama3.1:8b" | undefined;
    systemPrompt?: string | undefined;
    temperature?: number | undefined;
    maxTokens?: number | undefined;
    toolsEnabled?: ("consultarHorarios" | "reservarSlot" | "confirmarAgendamento" | "cancelarAgendamento" | "buscarAppointmentDoContato" | "consultarKnowledgeBase" | "transferirParaHumano")[] | undefined;
}>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
export declare const toggleAgentSchema: z.ZodObject<{
    id: z.ZodString;
    isActive: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    id: string;
    isActive: boolean;
}, {
    id: string;
    isActive: boolean;
}>;
export declare const deleteAgentSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const getAgentSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const listAgentsSchema: z.ZodOptional<z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>>;
export declare const linkChannelSchema: z.ZodObject<{
    agentId: z.ZodString;
    channelId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    agentId: string;
    channelId: string;
}, {
    agentId: string;
    channelId: string;
}>;
export declare const unlinkChannelSchema: z.ZodObject<{
    channelId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    channelId: string;
}, {
    channelId: string;
}>;
export declare const previewAgentSchema: z.ZodObject<{
    id: z.ZodString;
    messages: z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<["user", "assistant"]>;
        content: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        role: "user" | "assistant";
        content: string;
    }, {
        role: "user" | "assistant";
        content: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    id: string;
    messages: {
        role: "user" | "assistant";
        content: string;
    }[];
}, {
    id: string;
    messages: {
        role: "user" | "assistant";
        content: string;
    }[];
}>;
export type PreviewAgentInput = z.infer<typeof previewAgentSchema>;
export declare const listKnowledgeSchema: z.ZodObject<{
    agentId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    agentId: string;
}, {
    agentId: string;
}>;
export declare const getKnowledgeSchema: z.ZodObject<{
    agentId: z.ZodString;
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    agentId: string;
}, {
    id: string;
    agentId: string;
}>;
export declare const deleteKnowledgeSchema: z.ZodObject<{
    agentId: z.ZodString;
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    agentId: string;
}, {
    id: string;
    agentId: string;
}>;
export declare const reembedKnowledgeSchema: z.ZodObject<{
    agentId: z.ZodString;
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    agentId: string;
}, {
    id: string;
    agentId: string;
}>;
/** Para o preview de upload — volta do endpoint multipart. */
export declare const uploadPreviewSchema: z.ZodObject<{
    documentId: z.ZodString;
    title: z.ZodString;
    extractedText: z.ZodString;
    originalFilename: z.ZodString;
    fileSizeBytes: z.ZodNumber;
    mimeType: z.ZodString;
}, "strip", z.ZodTypeAny, {
    documentId: string;
    title: string;
    extractedText: string;
    originalFilename: string;
    fileSizeBytes: number;
    mimeType: string;
}, {
    documentId: string;
    title: string;
    extractedText: string;
    originalFilename: string;
    fileSizeBytes: number;
    mimeType: string;
}>;
export type UploadPreview = z.infer<typeof uploadPreviewSchema>;
export declare const confirmEmbeddingSchema: z.ZodObject<{
    agentId: z.ZodString;
    documentId: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    agentId: string;
    documentId: string;
    title?: string | undefined;
}, {
    agentId: string;
    documentId: string;
    title?: string | undefined;
}>;
export declare const metricsPeriodSchema: z.ZodEnum<["7d", "30d", "90d"]>;
export type MetricsPeriod = z.infer<typeof metricsPeriodSchema>;
export declare const metricsInputSchema: z.ZodObject<{
    agentId: z.ZodString;
    period: z.ZodDefault<z.ZodEnum<["7d", "30d", "90d"]>>;
}, "strip", z.ZodTypeAny, {
    agentId: string;
    period: "30d" | "7d" | "90d";
}, {
    agentId: string;
    period?: "30d" | "7d" | "90d" | undefined;
}>;
export declare const testEscalationSchema: z.ZodObject<{
    agentId: z.ZodString;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    agentId: string;
}, {
    message: string;
    agentId: string;
}>;
export interface AiAgentSummary {
    id: string;
    name: string;
    type: AiAgentType;
    model: AiAgentModel;
    isActive: boolean;
    channelIds: string[];
    lastActivityAt: string | null;
    createdAt: string;
}
export interface AiAgentDetail extends AiAgentSummary {
    systemPrompt: string | null;
    temperature: number;
    maxTokens: number;
    toolsEnabled: AiAgentTool[];
    config: AiAgentConfig;
}
export interface KnowledgeItem {
    id: string;
    agentId: string;
    title: string;
    contentPreview: string;
    originalFilename: string | null;
    mimeType: string | null;
    fileSizeBytes: number | null;
    embeddingStatus: EmbeddingStatus;
    embeddingError: string | null;
    createdAt: string;
}
export interface AgentMetrics {
    period: MetricsPeriod;
    totalConversations: number;
    resolutionRate: number;
    escalationRate: number;
    avgResponseSeconds: number | null;
    guardrailsTriggered: {
        diagnostico: number;
        prescricao: number;
        promessa: number;
    };
    intents: Array<{
        intent: AuroraIntent;
        count: number;
    }>;
    circuitBreakerOpens: number;
}
export interface AgentMetricsTimeline {
    period: MetricsPeriod;
    points: Array<{
        date: string;
        aurora: number;
        escalated: number;
    }>;
}
export interface EscalationTestResult {
    matchedRule: EscalationRule | null;
    intent: AuroraIntent;
    sentiment: 'negativo' | 'muito_negativo' | 'neutro' | 'positivo';
    wouldEscalate: boolean;
}
export { channelTypeSchema };
//# sourceMappingURL=aurora-admin.schema.d.ts.map