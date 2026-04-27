import { TRPCError } from '@trpc/server';
import { withClinicContext } from '../../../db/client.js';
import type { UpdateAISettingsInput, UpdateSystemPromptInput } from '@dermaos/shared';

const MAX_PROMPT_HISTORY = 5;

export async function getAISettings(clinicId: string) {
  return withClinicContext(clinicId, async (client) => {
    const { rows: clinic } = await client.query(
      `SELECT ai_config FROM shared.clinics WHERE id = $1`,
      [clinicId],
    );
    const aiConfig = (clinic[0]?.ai_config ?? {}) as Record<string, unknown>;

    const { rows: prompt } = await client.query(
      `SELECT id, prompt_text, token_estimate, created_at
         FROM shared.system_prompt_versions
         WHERE clinic_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
      [clinicId],
    );

    return {
      auroraEnabled:   (aiConfig['aurora_enabled'] as boolean) ?? true,
      preferredModel:  (aiConfig['preferred_model'] as string) ?? 'claude-sonnet-4-6',
      activePrompt:    prompt[0] ?? null,
    };
  });
}

export async function updateAISettings(
  clinicId: string,
  userId: string,
  input: UpdateAISettingsInput,
) {
  return withClinicContext(clinicId, async (client) => {
    const { rows } = await client.query(
      `SELECT ai_config FROM shared.clinics WHERE id = $1`,
      [clinicId],
    );
    const current = (rows[0]?.ai_config ?? {}) as Record<string, unknown>;

    const updated: Record<string, unknown> = { ...current };
    if (input.auroraEnabled !== undefined) updated['aurora_enabled'] = input.auroraEnabled;
    if (input.preferredModel !== undefined) updated['preferred_model'] = input.preferredModel;

    await client.query(
      `UPDATE shared.clinics SET ai_config = $1 WHERE id = $2`,
      [JSON.stringify(updated), clinicId],
    );

    await client.query(
      `INSERT INTO audit.domain_events
         (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1, 'settings', $1::uuid, 'settings.ai_updated', $2, $3)`,
      [
        clinicId,
        JSON.stringify({ changes: input }),
        JSON.stringify({ user_id: userId }),
      ],
    );

    return { ok: true, ...input };
  });
}

export async function updateSystemPrompt(
  clinicId: string,
  userId: string,
  input: UpdateSystemPromptInput,
) {
  // Rough token estimate: ~4 chars per token
  const tokenEstimate = Math.ceil(input.promptText.length / 4);

  if (tokenEstimate > 4000) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Prompt excede o limite de 4.000 tokens (estimativa: ${tokenEstimate}).`,
    });
  }

  return withClinicContext(clinicId, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO shared.system_prompt_versions
         (clinic_id, prompt_text, token_estimate, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, token_estimate, created_at`,
      [clinicId, input.promptText, tokenEstimate, userId],
    );

    await client.query(
      `INSERT INTO audit.domain_events
         (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1, 'settings', $2::uuid, 'settings.prompt_updated', $3, $4)`,
      [
        clinicId,
        rows[0].id,
        JSON.stringify({ token_estimate: tokenEstimate }),
        JSON.stringify({ user_id: userId }),
      ],
    );

    // Prune old versions, keep only last MAX_PROMPT_HISTORY
    await client.query(
      `DELETE FROM shared.system_prompt_versions
         WHERE clinic_id = $1
           AND id NOT IN (
             SELECT id FROM shared.system_prompt_versions
             WHERE clinic_id = $1
             ORDER BY created_at DESC
             LIMIT $2
           )`,
      [clinicId, MAX_PROMPT_HISTORY],
    );

    return rows[0];
  });
}

export async function getPromptHistory(clinicId: string) {
  return withClinicContext(clinicId, async (client) => {
    const { rows } = await client.query(
      `SELECT v.id, v.prompt_text, v.token_estimate, v.created_at, u.name AS created_by_name
         FROM shared.system_prompt_versions v
         LEFT JOIN shared.users u ON u.id = v.created_by
         WHERE v.clinic_id = $1
         ORDER BY v.created_at DESC
         LIMIT $2`,
      [clinicId, MAX_PROMPT_HISTORY],
    );
    return rows;
  });
}
