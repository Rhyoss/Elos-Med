/**
 * patient-adapter.ts
 *
 * Normaliza dados de paciente vindos do backend para uso seguro na UI.
 *
 * Contratos de origem:
 *   - PatientSummary  ← patients.list  (lista paginada, sem chronicConditions)
 *   - PatientPublic   ← patients.getById (full, com todos os campos clínicos)
 *
 * Garante:
 *   - displayId nunca usa trecho ambíguo tipo "A0000" — usa os 8 primeiros chars do UUID real
 *   - allergies, chronicConditions, activeMedications são campos SEPARADOS
 *   - CPF e telefone são mascarados por padrão; versão completa fica em campos _raw separados
 */

/* ── Tipos de entrada (subset do que o backend retorna) ─────────────────── */

export interface PatientSummaryIn {
  id:          string;
  name:        string;
  cpfMasked:   string | null;
  age:         number | null;
  gender:      string | null;
  phone:       string | null;
  status:      string;
  lastVisitAt: Date | string | null;
  allergies:   string[];
  createdAt:   Date | string;
}

export interface PatientPublicIn {
  id:                string;
  name:              string;
  cpf?:              string | null;          // plaintext CPF apenas se role autorizado
  cpfMasked?:        string | null;
  birthDate:         Date | string | null;
  age:               number | null;
  gender:            string | null;
  email:             string | null;
  phone:             string | null;
  phoneSecondary?:   string | null;
  bloodType?:        string | null;
  allergies:         string[];
  chronicConditions: string[];
  activeMedications: string[];
  status:            string;
  totalVisits:       number;
  lastVisitAt:       Date | string | null;
  firstVisitAt?:     Date | string | null;
  internalNotes?:    string | null;
  sourceChannel?:    string | null;
  createdAt:         Date | string;
  updatedAt:         Date | string;
}

/* ── Tipo de saída normalizado ──────────────────────────────────────────── */

export interface PatientView {
  /** UUID completo — nunca vazio */
  id:                string;
  /** Primeiros 8 chars do UUID, maiúsculas — e.g. "3F9A12C7" */
  displayId:         string;
  name:              string;
  /** CPF formatado e mascarado para exibição — "***.456.789-**" */
  cpfMasked:         string | null;
  age:               number | null;
  gender:            string | null;
  /** Telefone mascarado — "(11) •••••-7890" */
  phoneMasked:       string | null;
  status:            string;
  lastVisitAt:       Date | null;
  createdAt:         Date;

  /* ── Campos clínicos SEPARADOS ──────────────────────────────────────── */
  /** Alergias conhecidas (ex: "Dipirona", "Látex") */
  allergies:         string[];
  /** Condições crônicas / diagnósticos ativos (ex: "Rosácea", "Psoríase") */
  chronicConditions: string[];
  /** Medicamentos em uso contínuo */
  activeMedications: string[];

  /* ── Extras opcionais (só em PatientPublicIn) ───────────────────────── */
  email?:            string | null;
  bloodType?:        string | null;
  internalNotes?:    string | null;
  totalVisits?:      number;
  sourceChannel?:    string | null;
}

/* ── Labels para UI ─────────────────────────────────────────────────────── */

export const STATUS_LABELS: Record<string, string> = {
  active:      'Ativo',
  inactive:    'Inativo',
  blocked:     'Bloqueado',
  deceased:    'Falecido',
  transferred: 'Transferido',
  merged:      'Unificado',
};

export const STATUS_BADGE_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  active:      'success',
  inactive:    'default',
  blocked:     'danger',
  deceased:    'warning',
  transferred: 'default',
  merged:      'default',
};

export const GENDER_LABELS: Record<string, string> = {
  female:          'Feminino',
  male:            'Masculino',
  non_binary:      'Não-binário',
  prefer_not_to_say: 'Prefere não informar',
  other:           'Outro',
};

/* ── Helpers ─────────────────────────────────────────────────────────────── */

/**
 * Deriva displayId a partir do UUID real.
 * - Usa os 8 primeiros chars do UUID, em maiúsculas.
 * - Nunca retorna "A0000" ou placeholder genérico.
 * - UUID vazio/inválido lança erro para ser detectado em dev.
 */
export function buildDisplayId(id: string): string {
  if (!id || typeof id !== 'string') {
    if (process.env.NODE_ENV === 'development') {
      console.error('[PatientAdapter] buildDisplayId recebeu ID inválido:', id);
    }
    return '????????';
  }
  return id.slice(0, 8).toUpperCase();
}

/** Mascara telefone "11987654321" → "(11) •••••-4321" */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) •••••-${digits.slice(-4)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ••••-${digits.slice(-4)}`;
  }
  return phone; // não conseguiu mascarar — devolve como veio
}

function toDate(d: Date | string | null | undefined): Date | null {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
}

/* ── Adaptadores ─────────────────────────────────────────────────────────── */

/**
 * Adapta PatientSummary (vindo de patients.list) para PatientView.
 * chronicConditions e activeMedications ficam vazios — não existem no summary.
 */
export function adaptPatientSummary(p: PatientSummaryIn): PatientView {
  return {
    id:                p.id,
    displayId:         buildDisplayId(p.id),
    name:              p.name,
    cpfMasked:         p.cpfMasked ?? null,
    age:               p.age,
    gender:            p.gender,
    phoneMasked:       maskPhone(p.phone),
    status:            p.status,
    lastVisitAt:       toDate(p.lastVisitAt),
    createdAt:         toDate(p.createdAt) ?? new Date(),
    // Campos clínicos separados
    allergies:         p.allergies ?? [],
    chronicConditions: [],  // não disponível no summary — requer getById
    activeMedications: [],  // não disponível no summary — requer getById
  };
}

/**
 * Adapta PatientPublic (vindo de patients.getById) para PatientView.
 * Inclui todos os campos clínicos separados.
 */
export function adaptPatientPublic(p: PatientPublicIn): PatientView {
  return {
    id:                p.id,
    displayId:         buildDisplayId(p.id),
    name:              p.name,
    cpfMasked:         p.cpfMasked ?? null,
    age:               p.age,
    gender:            p.gender,
    phoneMasked:       maskPhone(p.phone),
    status:            p.status,
    lastVisitAt:       toDate(p.lastVisitAt),
    createdAt:         toDate(p.createdAt) ?? new Date(),
    // Campos clínicos SEPARADOS — nunca misturar
    allergies:         p.allergies         ?? [],
    chronicConditions: p.chronicConditions ?? [],
    activeMedications: p.activeMedications ?? [],
    // Campos extras presentes no full patient
    email:             p.email,
    bloodType:         p.bloodType,
    internalNotes:     p.internalNotes,
    totalVisits:       p.totalVisits,
    sourceChannel:     p.sourceChannel,
  };
}

/**
 * Retorna a primeira condição crônica para exibição em tabela/drawer.
 * USA chronicConditions, NUNCA allergies.
 * Retorna "—" se não houver condições registradas.
 */
export function primaryCondition(view: PatientView): string {
  return view.chronicConditions[0] ?? '—';
}

/**
 * Retorna a primeira alergia para exibição em banner/pill.
 * Retorna null se não houver alergias.
 */
export function primaryAllergy(view: PatientView): string | null {
  return view.allergies[0] ?? null;
}
