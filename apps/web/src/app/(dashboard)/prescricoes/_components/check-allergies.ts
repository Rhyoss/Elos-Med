/**
 * check-allergies.ts
 *
 * Heurística client-side para detectar conflitos entre itens de prescrição e
 * alergias conhecidas do paciente. Match por substring (case/diacritic-insensitive)
 * em campos textuais de cada item: name/formulation/components.substance.
 *
 * Limitação assumida: é um sinal preventivo, não um substituto para validação
 * farmacológica. Quando houver match, o usuário deve confirmar explicitamente
 * antes de emitir (ver allergy-confirm-dialog).
 */

import type { PrescriptionItem } from '@dermaos/shared';

export interface AllergyMatch {
  itemIndex: number;
  itemLabel: string;
  allergy:   string;
  matchedOn: string;
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function itemTextFields(item: PrescriptionItem): { label: string; field: string; text: string }[] {
  switch (item.type) {
    case 'topica':
      return [
        { label: item.name, field: 'name', text: item.name },
      ];
    case 'sistemica':
      return [
        { label: item.name, field: 'name', text: item.name },
      ];
    case 'manipulada':
      return [
        { label: item.formulation, field: 'formulation', text: item.formulation },
        ...item.components.map((c) => ({
          label: item.formulation,
          field: 'componente',
          text:  c.substance,
        })),
      ];
    case 'cosmeceutica':
      return [
        { label: item.name, field: 'name', text: item.name },
      ];
  }
}

function termsFromAllergy(allergy: string): string[] {
  return normalize(allergy)
    .split(/[\s/,;()-]+/)
    .filter((t) => t.length >= 3);
}

/**
 * Compara uma lista de itens de prescrição contra uma lista de alergias
 * registradas para o paciente. Retorna apenas matches de substring com termos
 * com 3+ caracteres para reduzir falsos positivos.
 */
export function detectAllergyConflicts(
  items:    readonly PrescriptionItem[],
  allergies: readonly string[],
): AllergyMatch[] {
  if (!items.length || !allergies.length) return [];
  const matches: AllergyMatch[] = [];
  for (let i = 0; i < items.length; i++) {
    const item   = items[i]!;
    const fields = itemTextFields(item);
    for (const allergy of allergies) {
      const terms = termsFromAllergy(allergy);
      if (terms.length === 0) continue;
      for (const f of fields) {
        const haystack = normalize(f.text);
        if (!haystack) continue;
        const hit = terms.find((t) => haystack.includes(t));
        if (hit) {
          matches.push({
            itemIndex: i,
            itemLabel: f.label,
            allergy,
            matchedOn: f.field,
          });
          break;
        }
      }
    }
  }
  return matches;
}
