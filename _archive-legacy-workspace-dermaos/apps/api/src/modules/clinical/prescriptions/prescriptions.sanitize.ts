/**
 * Sanitização de texto livre de prescrições para evitar XSS e injeção em PDF.
 *
 * - Remove tags HTML cruas
 * - Remove caracteres de controle (mantém \n/\t/espaços)
 * - Limita sequência de espaços consecutivos
 * - Corta strings a um tamanho máximo seguro
 *
 * Não substitui validações Zod — roda após elas, antes da persistência/render.
 */
export function sanitizeItemText(input: string, maxLength = 4000): string {
  const withoutTags = input.replace(/<\/?[a-z][^>]*>/gi, '');
  const withoutControl = withoutTags.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '');
  const collapsed = withoutControl.replace(/[ \t]{3,}/g, '  ');
  return collapsed.slice(0, maxLength).trim();
}
