import { TRPCError } from '@trpc/server';
import { withClinicContext, db } from '../../db/client.js';
import { logger } from '../../lib/logger.js';
import {
  TEMPLATE_VARIABLES,
  TEMPLATE_PREVIEW_DATA,
  TRIGGER_META,
  type CreateTemplateInput,
  type UpdateTemplateInput,
  type ListTemplatesInput,
  type AutomationTrigger,
} from '@dermaos/shared';

/* ── Tipos internos ──────────────────────────────────────────────────────── */

export interface TemplateRow {
  id:           string;
  clinic_id:    string;
  name:         string;
  channel_type: string | null;
  body:         string;
  body_html:    string | null;
  subject:      string | null;
  external_id:  string | null;   // meta_hsm_id
  is_default:   boolean;
  is_active:    boolean;
  created_at:   string;
  updated_at:   string;
  created_by:   string | null;
}

/* ── Padrão de variáveis permitidas no template ──────────────────────────── */

const VAR_PATTERN = /\{\{([a-z_]+)\}\}/g;

export function extractVariables(body: string): string[] {
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = VAR_PATTERN.exec(body)) !== null) {
    found.add(`{{${m[1]}}}`);
  }
  return [...found];
}

function assertValidVariables(body: string): void {
  const bodyVars = extractVariables(body);
  const allowed  = new Set(TEMPLATE_VARIABLES as readonly string[]);
  const invalid  = bodyVars.filter((v) => !allowed.has(v));
  if (invalid.length > 0) {
    throw new TRPCError({
      code:    'BAD_REQUEST',
      message: `Template contém variáveis inválidas: ${invalid.join(', ')}. Variáveis permitidas: ${TEMPLATE_VARIABLES.join(', ')}`,
    });
  }
}

/**
 * Valida que as variáveis usadas no template são todas disponíveis para o trigger.
 * Chamado ao associar template a uma automação.
 */
export function assertTemplateCompatibleWithTrigger(body: string, trigger: AutomationTrigger): void {
  const bodyVars    = extractVariables(body);
  const triggerVars = new Set(TRIGGER_META[trigger].variables);
  const unsupported = bodyVars.filter((v) => !triggerVars.has(v));
  if (unsupported.length > 0) {
    throw new TRPCError({
      code:    'BAD_REQUEST',
      message: `O template usa variáveis não disponíveis para o trigger "${trigger}": ${unsupported.join(', ')}.`,
    });
  }
}

/* ── Resolução de variáveis ────────────────────────────────────────────────
 * Sanitiza os valores antes de injetar para evitar que dados do paciente
 * contenham placeholders {{...}} que seriam confundidos com variáveis.
 */

function sanitizeValue(val: string): string {
  return val.replace(/\{\{|\}\}/g, '').trim();
}

export function resolveTemplateVariables(
  body:     string,
  vars:     Partial<Record<string, string>>,
  logWarns: boolean = false,
): string {
  return body.replace(VAR_PATTERN, (_match, key) => {
    const placeholder = `{{${key}}}`;
    const raw = vars[placeholder];
    if (raw === undefined || raw === null) {
      if (logWarns) {
        logger.warn({ placeholder }, 'template: variável sem valor — substituída por string vazia');
      }
      return '';
    }
    return sanitizeValue(raw);
  });
}

/* ── Preview com dados fictícios ─────────────────────────────────────────── */

export function previewTemplate(body: string): string {
  return resolveTemplateVariables(body, TEMPLATE_PREVIEW_DATA as Record<string, string>);
}

/* ── Listagem ────────────────────────────────────────────────────────────── */

export async function listTemplates(
  input:    ListTemplatesInput,
  clinicId: string,
): Promise<{ data: TemplateRow[]; nextCursor: string | null }> {
  return withClinicContext(clinicId, async (client) => {
    const conds: string[] = ['clinic_id = $1', 'is_active = TRUE'];
    const params: unknown[] = [clinicId];
    let p = 2;

    if (input.channel) {
      conds.push(`channel_type = $${p++}::omni.channel_type`);
      params.push(input.channel);
    }
    if (input.search?.trim()) {
      conds.push(`name ILIKE $${p++}`);
      params.push(`%${input.search.trim()}%`);
    }
    if (input.cursor) {
      conds.push(`created_at < $${p++}`);
      params.push(input.cursor);
    }

    params.push(input.limit + 1);

    const r = await client.query<TemplateRow>(
      `SELECT id, clinic_id, name, channel_type::text AS channel_type,
              body, body_html, subject, external_id, is_default,
              is_active, created_at, updated_at, created_by
         FROM omni.templates
        WHERE ${conds.join(' AND ')}
     ORDER BY is_default DESC, created_at DESC
        LIMIT $${p}`,
      params,
    );

    const hasMore = r.rows.length > input.limit;
    const data    = hasMore ? r.rows.slice(0, input.limit) : r.rows;
    return { data, nextCursor: hasMore ? data[data.length - 1]!.created_at : null };
  });
}

export async function getTemplateById(id: string, clinicId: string): Promise<TemplateRow> {
  return withClinicContext(clinicId, async (client) => {
    const r = await client.query<TemplateRow>(
      `SELECT id, clinic_id, name, channel_type::text AS channel_type,
              body, body_html, subject, external_id, is_default,
              is_active, created_at, updated_at, created_by
         FROM omni.templates
        WHERE id = $1 AND clinic_id = $2
        LIMIT 1`,
      [id, clinicId],
    );
    if (!r.rows[0]) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Template não encontrado.' });
    }
    return r.rows[0];
  });
}

/* ── Criação ─────────────────────────────────────────────────────────────── */

export async function createTemplate(
  input:    CreateTemplateInput,
  clinicId: string,
  userId:   string,
): Promise<TemplateRow> {
  assertValidVariables(input.body);

  return withClinicContext(clinicId, async (client) => {
    const r = await client.query<{ id: string }>(
      `INSERT INTO omni.templates
         (clinic_id, name, channel_type, body, body_html, subject, external_id,
          category, created_by)
       VALUES ($1, $2, $3::omni.channel_type, $4, $5, $6, $7, 'utility', $8)
       RETURNING id`,
      [
        clinicId, input.name, input.channel, input.body,
        input.bodyHtml ?? null, input.subject ?? null,
        input.metaHsmId ?? null, userId,
      ],
    );

    await db.query(
      `INSERT INTO audit.domain_events (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1, 'template', $2, 'template.created', $3, $4)`,
      [clinicId, r.rows[0]!.id, JSON.stringify({ name: input.name, channel: input.channel }), JSON.stringify({ user_id: userId })],
    );

    return getTemplateById(r.rows[0]!.id, clinicId);
  });
}

/* ── Atualização ─────────────────────────────────────────────────────────── */

export async function updateTemplate(
  input:    UpdateTemplateInput,
  clinicId: string,
  userId:   string,
): Promise<TemplateRow> {
  const current = await getTemplateById(input.id, clinicId);

  if (input.body) {
    assertValidVariables(input.body);
  }

  return withClinicContext(clinicId, async (client) => {
    await client.query(
      `UPDATE omni.templates
          SET name        = COALESCE($3, name),
              body        = COALESCE($4, body),
              body_html   = COALESCE($5, body_html),
              subject     = COALESCE($6, subject),
              external_id = COALESCE($7, external_id)
        WHERE id = $1 AND clinic_id = $2`,
      [
        input.id, clinicId,
        input.name      ?? null,
        input.body      ?? null,
        input.bodyHtml  ?? null,
        input.subject   ?? null,
        input.metaHsmId ?? null,
      ],
    );

    await db.query(
      `INSERT INTO audit.domain_events (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1, 'template', $2, 'template.updated', $3, $4)`,
      [clinicId, input.id, JSON.stringify({ fields: Object.keys(input) }), JSON.stringify({ user_id: userId })],
    );

    return getTemplateById(input.id, clinicId);
  });
}

/* ── Exclusão ────────────────────────────────────────────────────────────── */

export async function deleteTemplate(id: string, clinicId: string, userId: string): Promise<void> {
  const tpl = await getTemplateById(id, clinicId);

  if (tpl.is_default) {
    throw new TRPCError({
      code:    'FORBIDDEN',
      message: 'Templates padrão não podem ser excluídos. Você pode editar o conteúdo.',
    });
  }

  // Verifica se está em uso por alguma automação ativa
  const inUse = await db.query<{ cnt: string }>(
    `SELECT COUNT(*) AS cnt FROM omni.automations
      WHERE template_id = $1 AND is_active = TRUE`,
    [id],
  );
  if (parseInt(inUse.rows[0]?.cnt ?? '0', 10) > 0) {
    throw new TRPCError({
      code:    'CONFLICT',
      message: 'Template em uso por automações ativas. Desative as automações antes de excluir.',
    });
  }

  await withClinicContext(clinicId, async (client) => {
    await client.query(
      'UPDATE omni.templates SET is_active = FALSE WHERE id = $1 AND clinic_id = $2',
      [id, clinicId],
    );
    await db.query(
      `INSERT INTO audit.domain_events (clinic_id, aggregate_type, aggregate_id, event_type, metadata)
       VALUES ($1, 'template', $2, 'template.deleted', $3)`,
      [clinicId, id, JSON.stringify({ user_id: userId })],
    );
  });
}

/* ── Restaurar padrão ────────────────────────────────────────────────────── */

interface DefaultTemplateBody {
  whatsapp?: string;
  sms?: string;
  email?: { subject: string; body: string; bodyHtml: string };
}

const DEFAULT_BODIES: Record<string, DefaultTemplateBody> = {
  'Confirmação de Consulta': {
    whatsapp: 'Olá, {{nome_paciente}}! Sua consulta com {{medico}} na {{clinica}} foi confirmada para {{data_consulta}} às {{horario}}. Dúvidas? Ligue para {{telefone_clinica}}.',
    sms:      'Consulta confirmada: {{data_consulta}} às {{horario}} com {{medico}} - {{clinica}}. Dúvidas: {{telefone_clinica}}',
    email: {
      subject:  'Confirmação de Consulta — {{clinica}}',
      body:     'Olá, {{nome_paciente}}!\n\nSua consulta com {{medico}} na {{clinica}} foi confirmada para {{data_consulta}} às {{horario}}.\n\nDúvidas? Entre em contato: {{telefone_clinica}}',
      bodyHtml: '<p>Olá, <strong>{{nome_paciente}}</strong>!</p><p>Sua consulta com <strong>{{medico}}</strong> na <strong>{{clinica}}</strong> foi confirmada para <strong>{{data_consulta}} às {{horario}}</strong>.</p><p>Dúvidas? Entre em contato: <a href="tel:{{telefone_clinica}}">{{telefone_clinica}}</a></p>',
    },
  },
  'Lembrete 24h': {
    whatsapp: 'Olá, {{nome_paciente}}! Lembrando que amanhã você tem consulta com {{medico}} na {{clinica}} às {{horario}}. Até lá! 😊',
    sms:      'Lembrete: consulta amanhã às {{horario}} com {{medico}} - {{clinica}}. Dúvidas: {{telefone_clinica}}',
  },
  'Lembrete 2h': {
    whatsapp: 'Olá, {{nome_paciente}}! Sua consulta com {{medico}} na {{clinica}} começa em 2 horas ({{horario}}). Até logo!',
    sms:      'Sua consulta começa em 2h: {{horario}} com {{medico}} - {{clinica}}',
  },
  'Mensagem Pós-Consulta': {
    whatsapp: 'Olá, {{nome_paciente}}! Obrigado pela sua visita à {{clinica}}. Caso tenha alguma dúvida sobre a consulta de hoje, entre em contato: {{telefone_clinica}}. Cuide-se!',
  },
  'Resultado de Biópsia': {
    whatsapp: 'Olá, {{nome_paciente}}! O resultado da sua biópsia já está disponível na {{clinica}}. Entre em contato com {{medico}} pelo {{telefone_clinica}} para agendar a discussão do resultado.',
    email: {
      subject:  'Resultado de Biópsia Disponível — {{clinica}}',
      body:     'Olá, {{nome_paciente}}!\n\nO resultado da sua biópsia está disponível na {{clinica}}.\n\nEntre em contato com {{medico}}: {{telefone_clinica}}',
      bodyHtml: '<p>Olá, <strong>{{nome_paciente}}</strong>!</p><p>O resultado da sua biópsia está disponível na <strong>{{clinica}}</strong>.</p><p>Entre em contato com <strong>{{medico}}</strong>: <a href="tel:{{telefone_clinica}}">{{telefone_clinica}}</a></p>',
    },
  },
  'Feliz Aniversário': {
    whatsapp: '🎉 Feliz aniversário, {{nome_paciente}}! A equipe da {{clinica}} deseja um dia muito especial para você. Cuide-se sempre! 💙',
  },
  'Cobrança Amigável': {
    whatsapp: 'Olá, {{nome_paciente}}! Identificamos uma pendência financeira com a {{clinica}}. Para evitar inconvenientes, entre em contato conosco pelo {{telefone_clinica}}. Obrigado!',
  },
  'Lembrete de Retorno': {
    whatsapp: 'Olá, {{nome_paciente}}! {{medico}} da {{clinica}} gostaria de lembrá-lo(a) de agendar seu retorno. Ligue para {{telefone_clinica}} ou acesse nosso site para agendar. 🗓️',
  },
};

export async function restoreDefaultTemplate(id: string, clinicId: string, userId: string): Promise<TemplateRow> {
  const tpl = await getTemplateById(id, clinicId);
  if (!tpl.is_default) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Apenas templates padrão podem ser restaurados.' });
  }

  const defaults = DEFAULT_BODIES[tpl.name];
  if (!defaults) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Dados padrão não encontrados para este template.' });
  }

  const channel = (tpl.channel_type ?? 'whatsapp') as 'whatsapp' | 'sms' | 'email';
  const defaultBody = channel === 'email'
    ? defaults.email?.body
    : defaults[channel];

  if (!defaultBody) {
    throw new TRPCError({ code: 'NOT_FOUND', message: `Dados padrão não encontrados para canal "${channel}".` });
  }

  return updateTemplate(
    {
      id,
      body:     defaultBody,
      bodyHtml: channel === 'email' ? defaults.email?.bodyHtml : undefined,
      subject:  channel === 'email' ? defaults.email?.subject  : undefined,
    },
    clinicId,
    userId,
  );
}

/* ── Seed de templates padrão ─────────────────────────────────────────────── */

interface SeedEntry {
  name:      string;
  channel:   'whatsapp' | 'sms' | 'email';
  body:      string;
  bodyHtml?: string;
  subject?:  string;
}

function buildSeeds(): SeedEntry[] {
  const seeds: SeedEntry[] = [];
  for (const [name, bodies] of Object.entries(DEFAULT_BODIES)) {
    if (bodies.whatsapp) seeds.push({ name, channel: 'whatsapp', body: bodies.whatsapp });
    if (bodies.sms)      seeds.push({ name, channel: 'sms',      body: bodies.sms });
    if (bodies.email) {
      seeds.push({
        name, channel: 'email',
        body:     bodies.email.body,
        bodyHtml: bodies.email.bodyHtml,
        subject:  bodies.email.subject,
      });
    }
  }
  return seeds;
}

/**
 * Semeie templates padrão para um novo tenant.
 * Idempotente: não sobrescreve templates customizados existentes.
 */
export async function seedDefaultTemplates(clinicId: string, userId: string): Promise<number> {
  const seeds = buildSeeds();
  let created = 0;

  for (const seed of seeds) {
    try {
      await withClinicContext(clinicId, async (client) => {
        // ON CONFLICT não faz nada se já existe template com mesmo nome+clinicId
        const r = await client.query<{ id: string }>(
          `INSERT INTO omni.templates
             (clinic_id, name, channel_type, body, body_html, subject,
              category, is_default, created_by)
           VALUES ($1, $2, $3::omni.channel_type, $4, $5, $6, 'utility', TRUE, $7)
           ON CONFLICT (clinic_id, name) DO NOTHING
           RETURNING id`,
          [
            clinicId, `${seed.name} (${seed.channel.toUpperCase()})`,
            seed.channel, seed.body,
            seed.bodyHtml ?? null, seed.subject ?? null, userId,
          ],
        );
        if (r.rows[0]) created++;
      });
    } catch (err) {
      logger.error({ err, name: seed.name, clinicId }, 'template: seed failed');
    }
  }

  logger.info({ clinicId, created, total: seeds.length }, 'templates: seed completed');
  return created;
}
