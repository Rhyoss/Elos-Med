import { Queue } from 'bullmq';
import { redis } from '../db/redis.js';

export const QUEUE_NAMES = {
  LESION_IMAGE_PROCESSING:    'lesion-image-processing',
  OMNI_INBOUND:               'omni-inbound',
  OMNI_OUTBOUND:              'omni-outbound',
  AURORA_REASONING:           'aurora-reasoning',
  AURORA_EMBED:               'aurora-embed',
  SCHEDULING_HOLDS_CLEANUP:   'scheduling-holds-cleanup',
  SUPPLY_CONSUMPTION:         'supply-consumption',
  LGPD_EXPORT:                'lgpd-export',
} as const;

/**
 * Filas compartilhadas pela API. O conector BullMQ usa uma conexão Redis
 * dedicada (maxRetriesPerRequest: null é requisito para blocking commands).
 */
const connection = redis.duplicate({ maxRetriesPerRequest: null });

export const lesionImageQueue = new Queue(QUEUE_NAMES.LESION_IMAGE_PROCESSING, {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: { count: 500, age: 86_400 },
    removeOnFail:     { count: 2_000, age: 7 * 86_400 },
  },
});

export interface LesionImageJob {
  imageId:      string;
  clinicId:     string;
  objectKey:    string;
  mimeType:     string;
  originalName: string;
}

/**
 * Fila de mensagens recebidas via webhook. Deve reagir rápido: o webhook
 * precisa retornar 200 dentro de 3s (exigência Meta) — o processamento real
 * acontece aqui.
 */
export const omniInboundQueue = new Queue(QUEUE_NAMES.OMNI_INBOUND, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2_000 },
    removeOnComplete: { count: 1_000, age: 86_400 },
    removeOnFail:     { count: 5_000, age: 14 * 86_400 },   // DLQ manual via dashboard
  },
});

/** Payload normalizado vindo de qualquer provedor externo. */
export interface OmniInboundJob {
  provider:       'whatsapp' | 'instagram' | 'telegram' | 'email';
  receivedAt:     string;                                    // ISO
  /** clínica alvo — pode ser null se precisar ser resolvida via config do canal */
  clinicId:       string | null;
  channelId:      string | null;
  externalMessageId: string;
  externalContactId: string;                                 // phone/handle/email
  contactName:    string | null;
  contentType:    'text' | 'image' | 'audio' | 'video' | 'document' | 'location';
  content:        string | null;
  mediaUrl:       string | null;
  mediaMetadata:  Record<string, unknown>;
  raw:            Record<string, unknown>;
}

/** Jobs de envio outbound — fallback para canais que não permitem envio inline. */
export const omniOutboundQueue = new Queue(QUEUE_NAMES.OMNI_OUTBOUND, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2_000 },
    removeOnComplete: { count: 500, age: 86_400 },
    removeOnFail:     { count: 2_000, age: 7 * 86_400 },
  },
});

export interface OmniOutboundJob {
  messageId:      string;
  clinicId:       string;
  conversationId: string;
}

/**
 * Fila de raciocínio da Aurora (Anexo A §A.4.1).
 * Consumida por aurora-reasoning.processor. Idempotente por jobId='aurora:'+messageId.
 * Payload mínimo: referências por ID — worker carrega o resto sob withClinicContext.
 */
export const auroraReasoningQueue = new Queue(QUEUE_NAMES.AURORA_REASONING, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: { count: 1_000, age: 86_400 },
    removeOnFail:     { count: 5_000, age: 14 * 86_400 },
  },
});

export interface AuroraReasoningJob {
  messageId:      string;
  clinicId:       string;
  conversationId: string;
}

/**
 * Fila de embedding de documentos da Aurora (Fase 4 §1.3).
 * Consumida pelo worker. Idempotente por jobId='embed:'+documentId.
 * Payload mínimo — worker busca o texto/metadados via `withClinicContext`.
 */
export const auroraEmbedQueue = new Queue(QUEUE_NAMES.AURORA_EMBED, {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 3_000 },
    removeOnComplete: { count: 500, age: 86_400 },
    removeOnFail:     { count: 2_000, age: 14 * 86_400 },
  },
});

export interface AuroraEmbedJob {
  clinicId:   string;
  agentId:    string;
  documentId: string;
}

/**
 * Fila periódica de limpeza de scheduling_holds expirados (Anexo A §A.2.3).
 * Repeatable job: `DELETE FROM shared.scheduling_holds WHERE expires_at < NOW()` a cada 60s.
 * Roda no role do worker (dermaos_worker) — sem withClinicContext.
 */
export const schedulingHoldsCleanupQueue = new Queue(QUEUE_NAMES.SCHEDULING_HOLDS_CLEANUP, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: { count: 100, age: 3_600 },
    removeOnFail:     { count: 500, age: 86_400 },
  },
});

/* ── Fila de automações ──────────────────────────────────────────────────── */

/** Job de automação: disparado por trigger de negócio (agendamento, consulta, etc.). */
export const automationsQueue = new Queue('automations', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10_000 },
    removeOnComplete: { count: 1_000, age:  7 * 86_400 },
    removeOnFail:     { count: 5_000, age: 30 * 86_400 },
  },
});

export interface AutomationJob {
  executionLogId: string;
  automationId:   string;
  clinicId:       string;
  trigger:        string;
  entityId:       string;
  entityType:     string;
  fireAt:         string;  // ISO — quando deveria ter disparado (incluindo delay da automação)
}

/**
 * Fila de cron de aniversários: job diário que percorre pacientes com birthday=hoje
 * e enfileira um AutomationJob por paciente/clínica.
 * O worker verifica se a hora local da clínica é ~08:00.
 */
export const automationsBirthdayCronQueue = new Queue('automations-birthday-cron', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: { count: 100, age: 86_400 },
    removeOnFail:     { count: 500, age: 7 * 86_400 },
  },
});

export const AUTOMATIONS_BIRTHDAY_CRON_JOB_NAME  = 'birthday-scan';
export const AUTOMATIONS_BIRTHDAY_CRON_REPEAT_KEY = 'automations-birthday-cron-1h';

export async function scheduleAutomationsBirthdayCron(): Promise<void> {
  await automationsBirthdayCronQueue.add(
    AUTOMATIONS_BIRTHDAY_CRON_JOB_NAME,
    {},
    {
      jobId:  AUTOMATIONS_BIRTHDAY_CRON_REPEAT_KEY,
      repeat: { every: 3_600_000, immediately: true }, // a cada hora
      removeOnComplete: true,
      removeOnFail: { count: 500, age: 86_400 },
    },
  );
}

/* ── Fila de recálculo diário de status de estoque ──────────────────────── */

export const supplyStockDailyQueue = new Queue('supply-stock-daily', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: { count: 100, age: 86_400 },
    removeOnFail:     { count: 500, age: 7 * 86_400 },
  },
});

export interface SupplyStockDailyJob {
  triggeredAt: string; // ISO — timestamp do início do job
}

export const SUPPLY_STOCK_DAILY_JOB_NAME  = 'supply-stock-daily-scan';
export const SUPPLY_STOCK_DAILY_REPEAT_KEY = 'supply-stock-daily-24h';

export async function scheduleSupplyStockDailyScan(): Promise<void> {
  await supplyStockDailyQueue.add(
    SUPPLY_STOCK_DAILY_JOB_NAME,
    { triggeredAt: new Date().toISOString() },
    {
      jobId:  SUPPLY_STOCK_DAILY_REPEAT_KEY,
      repeat: { every: 86_400_000, immediately: true }, // 24 horas
      removeOnComplete: true,
      removeOnFail: { count: 100, age: 7 * 86_400 },
    },
  );
}

/* ── Fila de consumo automático de kits por procedimento ──────────────── */

/**
 * Disparada ao finalizar um encounter ou protocol_session. Carrega o kit
 * vinculado ao tipo de procedimento e registra o consumo (FEFO, atômico,
 * idempotente). Idempotência dupla: jobId + idempotency_key no banco.
 */
export const supplyConsumptionQueue = new Queue(QUEUE_NAMES.SUPPLY_CONSUMPTION, {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff:  { type: 'exponential', delay: 3_000 },
    removeOnComplete: { count: 1_000, age: 86_400 },
    removeOnFail:     { count: 5_000, age: 14 * 86_400 },
  },
});

export interface SupplyConsumptionJob {
  clinicId:          string;
  patientId:         string;
  encounterId?:      string | null;
  protocolSessionId?: string | null;
  serviceId?:        string | null;
  performedBy?:      string | null;
  triggeredAt:       string; // ISO
  source:            'encounter' | 'protocol_session';
}

/**
 * Enfileira consumo idempotente. jobId = idempotency_key para deduplicação.
 */
export async function enqueueSupplyConsumption(job: SupplyConsumptionJob): Promise<void> {
  const key = job.encounterId
    ? `encounter:${job.encounterId}`
    : `session:${job.protocolSessionId}`;
  await supplyConsumptionQueue.add('supply-consumption', job, {
    jobId: key,
    removeOnComplete: true,
  });
}

/* ── LGPD export queue ──────────────────────────────────────────────── */

export const lgpdExportQueue = new Queue(QUEUE_NAMES.LGPD_EXPORT, {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: { count: 100, age: 7 * 86_400 },
    removeOnFail:     { count: 500, age: 30 * 86_400 },
  },
});

export interface LgpdExportJob {
  jobId:        string;     // UUID do shared.lgpd_export_jobs
  clinicId:     string;
  patientId:    string;
  requestedBy:  string;
  email:        string;     // destino do link (descriptografado pelo caller)
  ip:           string | null;
}

export async function enqueueLgpdExport(job: LgpdExportJob): Promise<void> {
  await lgpdExportQueue.add('lgpd-export', job, {
    jobId: `lgpd:${job.jobId}`,
    removeOnComplete: true,
  });
}

export const SCHEDULING_HOLDS_CLEANUP_JOB_NAME = 'cleanup-expired-holds';
export const SCHEDULING_HOLDS_CLEANUP_REPEAT_KEY = 'scheduling-holds-cleanup-1m';

/**
 * Enfileira o job repetível de limpeza de holds expirados (idempotente — usa
 * `jobId` fixo e `repeat.key`; BullMQ deduplica execuções já registradas).
 * Chamar uma vez na startup do worker.
 */
export async function scheduleSchedulingHoldsCleanup(): Promise<void> {
  await schedulingHoldsCleanupQueue.add(
    SCHEDULING_HOLDS_CLEANUP_JOB_NAME,
    {},
    {
      jobId: SCHEDULING_HOLDS_CLEANUP_REPEAT_KEY,
      repeat: {
        every: 60_000,               // 1 minuto — Anexo A §A.2.3
        immediately: true,
      },
      removeOnComplete: true,
      removeOnFail:     { count: 500, age: 86_400 },
    },
  );
}
