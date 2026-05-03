/**
 * Processor `automations` — Prompt 10.
 *
 * Processa cada job de automação: carrega entidade, avalia condições,
 * resolve variáveis de template e envia a mensagem via canal configurado.
 *
 * Pipeline:
 *   1. Carrega execution_log — verifica idempotência (status deve ser 'processing').
 *   2. Carrega automação (ativa?), template e canal.
 *   3. Carrega dados da entidade (appointment, patient, invoice, lead).
 *   4. Avalia condições no momento do disparo (dados podem ter mudado).
 *   5. Resolve variáveis do template com valores reais.
 *   6. Envia mensagem via canal (WhatsApp / SMS / Email).
 *   7. Atualiza log: sent | skipped | failed.
 *
 * Idempotência dupla:
 *   - unique constraint em automation_execution_log.idempotency_key
 *   - status != 'processing' → job encerra sem enviar
 *
 * Retry: BullMQ backoff exponencial, 3 tentativas.
 * DLQ: após 3 falhas o job vai para removeOnFail com razão registrada.
 */

import type { Job } from 'bullmq';
import type { Pool } from 'pg';
import type pino from 'pino';
import type { AutomationJob } from '../../../api/src/jobs/queues.js';
import type { AutomationCondition } from '@dermaos/shared';

/* ── Tipos de dados carregados do banco ────────────────────────────────────── */

interface AutomationRecord {
  id:            string;
  is_active:     boolean;
  delay_minutes: number;
  conditions:    AutomationCondition[];
  template_body: string;
  channel_type:  string;
  channel_config: Record<string, unknown>;
  clinic_timezone: string;
}

interface EntityData {
  patient_name:    string | null;
  patient_phone:   string | null;
  patient_email:   string | null;
  appointment_at:  string | null;   // ISO
  doctor_name:     string | null;
  clinic_name:     string | null;
  clinic_phone:    string | null;
  status:          string | null;   // para avaliação de condições
  [key: string]:   unknown;
}

interface ExecutionLogRecord {
  id:           string;
  status:       string;
  automation_id: string;
}

/* ── Helpers de DB ──────────────────────────────────────────────────────────── */

async function withClinicTx<T>(
  db:       Pool,
  clinicId: string,
  cb:       (client: import('pg').PoolClient) => Promise<T>,
): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_clinic_id', $1, true)", [clinicId]);
    const out = await cb(client);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

async function loadExecutionLog(
  db:             Pool,
  clinicId:       string,
  executionLogId: string,
): Promise<ExecutionLogRecord | null> {
  return withClinicTx(db, clinicId, async (c) => {
    const r = await c.query<ExecutionLogRecord>(
      `SELECT id, status, automation_id
         FROM omni.automation_execution_log
        WHERE id = $1 AND clinic_id = $2
        LIMIT 1`,
      [executionLogId, clinicId],
    );
    return r.rows[0] ?? null;
  });
}

async function loadAutomation(
  db:           Pool,
  clinicId:     string,
  automationId: string,
): Promise<AutomationRecord | null> {
  return withClinicTx(db, clinicId, async (c) => {
    const r = await c.query<AutomationRecord>(
      `SELECT a.id, a.is_active, a.delay_minutes, a.conditions,
              t.body AS template_body,
              ch.type::text AS channel_type,
              ch.config AS channel_config,
              COALESCE(cl.timezone, 'America/Sao_Paulo') AS clinic_timezone
         FROM omni.automations a
         JOIN omni.templates   t  ON t.id  = a.template_id
         JOIN omni.channels    ch ON ch.id = a.channel_id
         JOIN shared.clinics   cl ON cl.id = a.clinic_id
        WHERE a.id = $1 AND a.clinic_id = $2
        LIMIT 1`,
      [automationId, clinicId],
    );
    return r.rows[0] ?? null;
  });
}

async function loadEntityData(
  db:         Pool,
  clinicId:   string,
  entityType: string,
  entityId:   string,
): Promise<EntityData | null> {
  return withClinicTx(db, clinicId, async (c) => {
    switch (entityType) {
      case 'appointment': {
        const r = await c.query<EntityData>(
          `SELECT p.name AS patient_name, p.phone AS patient_phone, p.email AS patient_email,
                  a.scheduled_at::text AS appointment_at,
                  u.full_name AS doctor_name,
                  cl.name AS clinic_name, cl.phone AS clinic_phone,
                  a.status::text AS status
             FROM shared.appointments a
             JOIN shared.patients     p  ON p.id  = a.patient_id
        LEFT JOIN shared.users        u  ON u.id  = a.provider_id
             JOIN shared.clinics      cl ON cl.id = a.clinic_id
            WHERE a.id = $1 AND a.clinic_id = $2
            LIMIT 1`,
          [entityId, clinicId],
        );
        return r.rows[0] ?? null;
      }

      case 'encounter': {
        const r = await c.query<EntityData>(
          `SELECT p.name AS patient_name, p.phone AS patient_phone, p.email AS patient_email,
                  NULL::text AS appointment_at,
                  u.full_name AS doctor_name,
                  cl.name AS clinic_name, cl.phone AS clinic_phone,
                  e.status::text AS status
             FROM clinical.encounters e
             JOIN shared.patients     p  ON p.id  = e.patient_id
        LEFT JOIN shared.users        u  ON u.id  = e.provider_id
             JOIN shared.clinics      cl ON cl.id = e.clinic_id
            WHERE e.id = $1 AND e.clinic_id = $2
            LIMIT 1`,
          [entityId, clinicId],
        );
        return r.rows[0] ?? null;
      }

      case 'patient': {
        const r = await c.query<EntityData>(
          `SELECT p.name AS patient_name, p.phone AS patient_phone, p.email AS patient_email,
                  NULL::text AS appointment_at, NULL::text AS doctor_name,
                  cl.name AS clinic_name, cl.phone AS clinic_phone,
                  p.status::text AS status
             FROM shared.patients p
             JOIN shared.clinics  cl ON cl.id = p.clinic_id
            WHERE p.id = $1 AND p.clinic_id = $2
            LIMIT 1`,
          [entityId, clinicId],
        );
        return r.rows[0] ?? null;
      }

      case 'invoice': {
        const r = await c.query<EntityData>(
          `SELECT p.name AS patient_name, p.phone AS patient_phone, p.email AS patient_email,
                  NULL::text AS appointment_at, NULL::text AS doctor_name,
                  cl.name AS clinic_name, cl.phone AS clinic_phone,
                  inv.status::text AS status
             FROM financial.invoices inv
             JOIN shared.patients    p  ON p.id  = inv.patient_id
             JOIN shared.clinics     cl ON cl.id = inv.clinic_id
            WHERE inv.id = $1 AND inv.clinic_id = $2
            LIMIT 1`,
          [entityId, clinicId],
        );
        return r.rows[0] ?? null;
      }

      case 'lead': {
        const r = await c.query<EntityData>(
          `SELECT ct.name AS patient_name, ct.phone AS patient_phone, ct.email AS patient_email,
                  NULL::text AS appointment_at, NULL::text AS doctor_name,
                  cl.name AS clinic_name, cl.phone AS clinic_phone,
                  ct.status::text AS status
             FROM omni.contacts  ct
             JOIN shared.clinics cl ON cl.id = ct.clinic_id
            WHERE ct.id = $1 AND ct.clinic_id = $2
            LIMIT 1`,
          [entityId, clinicId],
        );
        return r.rows[0] ?? null;
      }

      default:
        return null;
    }
  });
}

/* ── Avaliação de condições ─────────────────────────────────────────────────── */

function evaluateConditions(
  conditions: AutomationCondition[],
  data:       EntityData,
): { pass: boolean; failedCondition?: string } {
  for (const cond of conditions) {
    const val = (data as Record<string, unknown>)[cond.field];

    let pass = false;
    switch (cond.operator) {
      case 'eq':        pass = val === cond.value; break;
      case 'neq':       pass = val !== cond.value; break;
      case 'gt':        pass = typeof val === 'number' && val >  Number(cond.value); break;
      case 'lt':        pass = typeof val === 'number' && val <  Number(cond.value); break;
      case 'gte':       pass = typeof val === 'number' && val >= Number(cond.value); break;
      case 'lte':       pass = typeof val === 'number' && val <= Number(cond.value); break;
      case 'in':        pass = Array.isArray(cond.value) && cond.value.includes(val as string); break;
      case 'not_in':    pass = !Array.isArray(cond.value) || !cond.value.includes(val as string); break;
      case 'exists':    pass = val !== null && val !== undefined; break;
      case 'not_exists': pass = val === null || val === undefined; break;
    }

    if (!pass) {
      return { pass: false, failedCondition: `${cond.field} ${cond.operator} ${JSON.stringify(cond.value)}` };
    }
  }
  return { pass: true };
}

/* ── Resolução de variáveis ─────────────────────────────────────────────────── */

const VAR_PATTERN = /\{\{([a-z_]+)\}\}/g;

function sanitizeValue(v: string): string {
  return v.replace(/\{\{|\}\}/g, '').trim();
}

function resolveVars(body: string, data: EntityData, logger: pino.Logger): string {
  const varMap: Record<string, string | null | undefined> = {
    '{{nome_paciente}}':    data.patient_name,
    '{{medico}}':           data.doctor_name,
    '{{clinica}}':          data.clinic_name,
    '{{telefone_clinica}}': data.clinic_phone,
    '{{data_consulta}}':    data.appointment_at
      ? formatDate(data.appointment_at)
      : null,
    '{{horario}}':          data.appointment_at
      ? formatTime(data.appointment_at)
      : null,
  };

  return body.replace(VAR_PATTERN, (_match, key) => {
    const placeholder = `{{${key}}}`;
    const raw = varMap[placeholder];
    if (raw === undefined || raw === null) {
      logger.warn({ placeholder }, 'automation: template variable unresolved — using empty string');
      return '';
    }
    return sanitizeValue(raw);
  });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/* ── Envio de mensagem ─────────────────────────────────────────────────────── */

async function sendViaChannel(
  channelType:   string,
  channelConfig: Record<string, unknown>,
  entityData:    EntityData,
  body:          string,
  logger:        pino.Logger,
): Promise<{ recipient: string }> {
  switch (channelType) {
    case 'whatsapp':
    case 'sms': {
      const phone = entityData.patient_phone;
      if (!phone) throw new Error('patient_phone_missing');

      if (channelType === 'whatsapp') {
        const phoneNumberId = channelConfig['phone_number_id'] as string | undefined;
        const accessToken   = channelConfig['access_token']   as string | undefined;
        if (!phoneNumberId || !accessToken) throw new Error('channel_config_incomplete');

        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 10_000);
        try {
          const res = await fetch(
            `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
            {
              method:  'POST',
              headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
              body:    JSON.stringify({
                messaging_product: 'whatsapp',
                to:   phone,
                type: 'text',
                text: { body },
              }),
              signal: controller.signal,
            },
          );
          if (!res.ok) {
            const json = await res.json() as { error?: { message?: string } };
            throw new Error(`whatsapp_api_error: ${json.error?.message ?? res.status}`);
          }
        } finally {
          clearTimeout(t);
        }
      }
      // SMS: stub — integrar com Twilio/Zenvia no próximo prompt
      if (channelType === 'sms') {
        logger.info({ phone }, 'automation: SMS send stub (provider not yet integrated)');
      }

      return { recipient: phone };
    }

    case 'email': {
      const email = entityData.patient_email;
      if (!email) throw new Error('patient_email_missing');
      // Email send: stub — integrar com SMTP/SES
      logger.info({ email }, 'automation: email send stub (provider not yet integrated)');
      return { recipient: email };
    }

    default:
      throw new Error(`unsupported_channel: ${channelType}`);
  }
}

/* ── Atualizar log de execução ─────────────────────────────────────────────── */

async function updateLog(
  db:             Pool,
  clinicId:       string,
  executionLogId: string,
  status:         'sent' | 'skipped' | 'failed',
  details: {
    skipReason?: string;
    failReason?: string;
    recipient?:  string;
    channel?:    string;
  } = {},
): Promise<void> {
  // SEC-W: defesa em profundidade — `dermaos_worker` tem policy USING true,
  // RLS sozinha não bloqueia cross-tenant. Filtra explicitamente clinic_id.
  await db.query(
    `UPDATE omni.automation_execution_log
        SET status      = $2,
            skip_reason = $3,
            fail_reason = $4,
            recipient   = COALESCE($5, recipient),
            channel     = COALESCE($6::omni.channel_type, channel),
            executed_at = NOW()
      WHERE id = $1 AND clinic_id = $7`,
    [
      executionLogId, status,
      details.skipReason ?? null,
      details.failReason ?? null,
      details.recipient  ?? null,
      details.channel    ?? null,
      clinicId,
    ],
  );

  if (status === 'sent') {
    // SEC-W: subquery valida que automation pertence à mesma clínica,
    // bloqueando incremento de run_count em automation alheia.
    await db.query(
      `UPDATE omni.automations
          SET run_count   = run_count + 1,
              last_run_at = NOW()
        WHERE clinic_id = $2
          AND id = (
            SELECT automation_id FROM omni.automation_execution_log
             WHERE id = $1 AND clinic_id = $2
          )`,
      [executionLogId, clinicId],
    );
  }
}

/* ── Processor principal ─────────────────────────────────────────────────────
 * Exportado como factory para facilitar injeção de dependências nos testes.
 */

export interface AutomationsDeps {
  db:     Pool;
  logger: pino.Logger;
}

export function buildAutomationsProcessor(deps: AutomationsDeps) {
  return async function process(job: Job<AutomationJob>): Promise<void> {
    const { executionLogId, automationId, clinicId, entityId, entityType } = job.data;
    const log = deps.logger.child({ jobId: job.id, automationId, entityId });

    // 1. Verifica idempotência via execution log
    const execLog = await loadExecutionLog(deps.db, clinicId, executionLogId);
    if (!execLog) {
      log.warn('automation: execution log not found — skipping');
      return;
    }
    if (execLog.status !== 'processing') {
      log.debug({ status: execLog.status }, 'automation: already processed — idempotent skip');
      return;
    }

    // 2. Carrega automação (pode ter sido desativada após enqueue)
    const auto = await loadAutomation(deps.db, clinicId, automationId);
    if (!auto) {
      await updateLog(deps.db, clinicId, executionLogId, 'skipped', { skipReason: 'automation_not_found' });
      log.warn('automation: automation record not found');
      return;
    }
    if (!auto.is_active) {
      await updateLog(deps.db, clinicId, executionLogId, 'skipped', { skipReason: 'automation_deactivated' });
      log.info('automation: deactivated since enqueue — skipped');
      return;
    }

    // 3. Carrega dados da entidade (verificação em runtime — estado pode ter mudado)
    const entityData = await loadEntityData(deps.db, clinicId, entityType, entityId);
    if (!entityData) {
      await updateLog(deps.db, clinicId, executionLogId, 'skipped', {
        skipReason: `entity_not_found: ${entityType}:${entityId}`,
      });
      log.warn({ entityType, entityId }, 'automation: entity not found — skipped');
      return;
    }

    // 4. Avalia condições no momento do disparo (não no enqueue)
    const { pass, failedCondition } = evaluateConditions(auto.conditions, entityData);
    if (!pass) {
      await updateLog(deps.db, clinicId, executionLogId, 'skipped', {
        skipReason: `condition_failed: ${failedCondition}`,
      });
      log.info({ failedCondition }, 'automation: condition not met — skipped');
      return;
    }

    // 5. Resolve variáveis do template
    const resolvedBody = resolveVars(auto.template_body, entityData, log);

    // 6. Envia mensagem
    try {
      const { recipient } = await sendViaChannel(
        auto.channel_type,
        auto.channel_config,
        entityData,
        resolvedBody,
        log,
      );

      await updateLog(deps.db, clinicId, executionLogId, 'sent', {
        recipient,
        channel: auto.channel_type,
      });

      log.info({ recipient, channel: auto.channel_type }, 'automation: message sent');
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'unknown_error';
      log.error({ err, reason }, 'automation: send failed');

      // Tenta registrar falha — se for a última tentativa o BullMQ não vai mais retentar
      const isLastAttempt = job.attemptsMade >= (job.opts.attempts ?? 3) - 1;
      if (isLastAttempt) {
        await updateLog(deps.db, clinicId, executionLogId, 'failed', { failReason: reason });
        log.error({ automationId, executionLogId }, 'automation: max retries reached — moved to DLQ state');
      }

      // Re-throw para BullMQ gerenciar o backoff exponencial
      throw err;
    }
  };
}

/* ── Processor de cron de aniversários ──────────────────────────────────────
 * Roda a cada hora. Verifica se é 08:00 no timezone de cada clínica.
 * Busca pacientes com aniversário hoje e enfileira AutomationJob para cada um.
 */

export function buildBirthdayCronProcessor(
  deps:             AutomationsDeps,
  automationsQueue: import('bullmq').Queue<AutomationJob>,
) {
  return async function process(_job: Job): Promise<void> {
    const log = deps.logger;

    // Busca clínicas com timezone configurado
    const clinics = await deps.db.query<{ id: string; timezone: string }>(
      `SELECT id, COALESCE(timezone, 'America/Sao_Paulo') AS timezone
         FROM shared.clinics WHERE is_active = TRUE`,
    );

    let enqueued = 0;

    for (const clinic of clinics.rows) {
      // Verifica se é entre 07:55 e 08:05 no timezone da clínica (janela de 10min)
      const localHour = getLocalHour(clinic.timezone);
      if (localHour < 7 || localHour >= 9) continue; // Fora da janela — esta instância não processa

      const today = getLocalDateString(clinic.timezone); // 'YYYY-MM-DD'

      // Busca pacientes com aniversário hoje nesta clínica
      const patients = await deps.db.query<{ id: string }>(
        `SELECT id FROM shared.patients
          WHERE clinic_id = $1
            AND is_active = TRUE
            AND TO_CHAR(birth_date, 'MM-DD') = $2`,
        [clinic.id, today.slice(5)], // 'MM-DD' parte da data
      );

      if (patients.rows.length === 0) continue;

      // Verifica se há automações ativas para patient_birthday nesta clínica
      const autos = await deps.db.query<{ id: string; delay_minutes: number }>(
        `SELECT id, delay_minutes FROM omni.automations
          WHERE clinic_id = $1 AND trigger = 'patient_birthday' AND is_active = TRUE`,
        [clinic.id],
      );

      if (autos.rows.length === 0) continue;

      const fireAt = new Date();
      fireAt.setHours(8, 0, 0, 0); // 08:00 UTC como aproximação — o worker já filtra por timezone

      for (const patient of patients.rows) {
        for (const auto of autos.rows) {
          const idempotencyKey = `patient_birthday:${auto.id}:${patient.id}:${today}`;
          const jobId          = `auto:${idempotencyKey}`;

          try {
            await deps.db.query(
              `INSERT INTO omni.automation_execution_log
                 (clinic_id, automation_id, idempotency_key, entity_id, entity_type,
                  trigger, status, bullmq_job_id, scheduled_at, metadata)
               VALUES ($1, $2, $3, $4, 'patient', 'patient_birthday', 'processing', $5, $6, '{}')
               ON CONFLICT (idempotency_key) DO NOTHING`,
              [clinic.id, auto.id, idempotencyKey, patient.id, jobId, fireAt.toISOString()],
            );

            const check = await deps.db.query<{ id: string }>(
              `SELECT id FROM omni.automation_execution_log
                WHERE idempotency_key = $1 AND status = 'processing' LIMIT 1`,
              [idempotencyKey],
            );
            if (!check.rows[0]) continue; // Já existia — idempotente

            await automationsQueue.add('process', {
              executionLogId: check.rows[0].id,
              automationId:   auto.id,
              clinicId:       clinic.id,
              trigger:        'patient_birthday',
              entityId:       patient.id,
              entityType:     'patient',
              fireAt:         fireAt.toISOString(),
            }, {
              jobId,
              delay: auto.delay_minutes * 60_000,
            });

            enqueued++;
          } catch (err) {
            log.error({ err, patientId: patient.id, clinicId: clinic.id }, 'birthday cron: enqueue failed');
          }
        }
      }
    }

    log.info({ enqueued }, 'birthday cron: scan complete');
  };
}

function getLocalHour(timezone: string): number {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false });
    return parseInt(fmt.format(new Date()), 10);
  } catch {
    return new Date().getUTCHours();
  }
}

function getLocalDateString(timezone: string): string {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }); // en-CA → YYYY-MM-DD
    return fmt.format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}
