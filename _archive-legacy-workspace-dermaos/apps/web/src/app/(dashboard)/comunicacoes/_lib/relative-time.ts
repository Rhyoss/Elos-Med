/**
 * Formata um timestamp como tempo relativo em pt-BR.
 * Agora mesmo · 3 min · 2h · ontem · 3d · dd/mm
 */
export function formatRelativeTime(date: Date | string | null): string {
  if (!date) return '';
  const d = new Date(date);
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 45) return 'agora';
  if (diffSec < 90) return '1 min';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;

  const isYesterday = diffHr < 48;
  if (isYesterday) return 'ontem';

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;

  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(d);
}

export function formatClockTime(date: Date | string): string {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(date),
  );
}
