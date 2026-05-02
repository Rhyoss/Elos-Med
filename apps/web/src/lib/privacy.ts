/**
 * privacy.ts — Data masking and sanitization utilities for LGPD compliance.
 *
 * All masking functions are pure and deterministic.
 * Re-exports maskCpf/maskPhone from patient-adapter for convenience.
 */

export { maskCpf, maskPhone } from '@/lib/adapters/patient-adapter';

/** Masks email: "user@domain.com" → "us***@domain.com" */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.indexOf('@');
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 2) return `${local[0]}***${domain}`;
  return `${local.slice(0, 2)}***${domain}`;
}

/** Masks monetary value: "R$ 1.234,56" → "R$ •••••" */
export function maskCurrency(_value: number): string {
  return 'R$ •••••';
}

/**
 * Sanitize error messages for end-user display.
 * Strips stack traces, internal paths, SQL, and sensitive tokens.
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (!error) return 'Ocorreu um erro inesperado.';

  const raw = error instanceof Error ? error.message : String(error);

  if (!raw || raw.length === 0) return 'Ocorreu um erro inesperado.';

  // Never show stack traces
  if (raw.includes('\n    at ') || raw.includes('node_modules')) {
    return 'Ocorreu um erro interno. Tente novamente ou contate o suporte.';
  }

  // Never show SQL errors
  if (/\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN)\b/i.test(raw) && raw.length > 80) {
    return 'Erro de processamento de dados. Tente novamente.';
  }

  // Never show internal paths
  if (/\/(src|apps|node_modules|dist)\//i.test(raw)) {
    return 'Ocorreu um erro interno. Tente novamente ou contate o suporte.';
  }

  // Truncate overly long messages
  if (raw.length > 200) {
    return raw.slice(0, 180) + '…';
  }

  return raw;
}

/**
 * Formats an audit metadata line: "Criado por Dr. Silva em 01/jan/2026"
 */
export function formatAuditMeta(
  author: string | null | undefined,
  date: Date | string | null | undefined,
): string | null {
  if (!author && !date) return null;
  const parts: string[] = [];
  if (author) parts.push(`por ${author}`);
  if (date) {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (!isNaN(d.getTime())) {
      parts.push(
        `em ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`,
      );
    }
  }
  return parts.length > 0 ? parts.join(' ') : null;
}

/** Max file size label for upload validation errors */
export function fileSizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Validates file type against an allowlist.
 * Returns error message or null if valid.
 */
export function validateFileType(
  file: File,
  allowedExtensions: readonly string[],
  allowedMimes?: readonly string[],
): string | null {
  const dot = file.name.lastIndexOf('.');
  const ext = (dot >= 0 ? file.name.slice(dot) : '').toLowerCase();

  if (!allowedExtensions.includes(ext)) {
    return `Tipo de arquivo não permitido: ${ext || 'sem extensão'}. Formatos aceitos: ${allowedExtensions.join(', ')}`;
  }

  if (allowedMimes && !allowedMimes.includes(file.type) && file.type !== '') {
    return `Tipo MIME não permitido: ${file.type}`;
  }

  return null;
}
