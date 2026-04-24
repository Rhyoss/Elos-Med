/**
 * Sanitização mínima de conteúdo textual antes de persistir.
 * Remove caracteres de controle e normaliza quebras de linha.
 * Escaping para HTML é feito no frontend na renderização.
 */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function sanitizeMessageText(input: string): string {
  return input
    .normalize('NFC')
    .replace(CONTROL_CHARS, '')
    .replace(/\r\n/g, '\n')
    .trim();
}

/**
 * Gera preview curto para `last_message_preview`.
 * Remove quebras de linha e corta a 80 caracteres.
 */
export function makePreview(text: string, maxLen = 80): string {
  const single = text.replace(/\s+/g, ' ').trim();
  if (single.length <= maxLen) return single;
  return `${single.slice(0, maxLen - 1)}…`;
}
