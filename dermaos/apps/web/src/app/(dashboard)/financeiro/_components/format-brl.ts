/** Formata centavos para BRL: 15000 → "R$\u00a0150,00" */
export function formatBRL(centavos: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style:    'currency',
    currency: 'BRL',
  }).format(centavos / 100);
}

/** Formata data ISO para pt-BR */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(iso));
}

/** Formata hora de um timestamp ISO */
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' }).format(new Date(iso));
}
