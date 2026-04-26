/**
 * Contexto compartilhado entre as tools da Aurora.
 *
 * Cada chamada de tool carrega o escopo da conversa (clínica + canal + contato)
 * para que o wrapper possa chamar os serviços existentes preservando RLS via
 * `withClinicContext` (já feito dentro dos serviços chamados).
 *
 * `patientId` é OPCIONAL porque nem toda conversa tem paciente já vinculado
 * (lead → paciente acontece depois do primeiro agendamento).
 */

export interface AuroraToolContext {
  clinicId:        string;
  conversationId:  string;
  contactId:       string;
  /** Preenchido quando o contato já está vinculado a um paciente. */
  patientId?:      string;
  /** UserID sintético da Aurora (para colunas `userId` exigidas pelos serviços). */
  auroraUserId:    string;
}

/**
 * Resultado comum a TODAS as tools.
 *
 * `ok: true` → `data` contém o payload JSON-serializável devolvido à LLM.
 * `ok: false` → `error.code` é um slug estável (ex.: 'slot_conflict',
 *                'hold_expired', 'scheduling_forbidden') que o raciocínio da
 *                Aurora usa para decidir próxima ação.
 *
 * Strings de erro NUNCA carregam PHI. `error.message` é pt-BR curto, seguro
 * para exibir em logs e para o LLM interpretar.
 */
export type AuroraToolResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: { code: string; message: string } };

/**
 * Definição de tool no formato Anthropic tool-use (sem dependência direta
 * do SDK — Phase 3 converte para `Anthropic.Tool`).
 */
export interface AuroraToolDefinition {
  name:         string;
  description:  string;
  input_schema: {
    type:       'object';
    properties: Record<string, unknown>;
    required?:  string[];
  };
}
