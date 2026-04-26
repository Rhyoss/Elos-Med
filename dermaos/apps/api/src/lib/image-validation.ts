import path from 'node:path';
import {
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_SIZE_BYTES,
} from '@dermaos/shared';

/**
 * Magic-byte signatures para validar o conteúdo real do arquivo
 * — NÃO confiar no header Content-Type vindo do cliente.
 */
const MAGIC_BYTES: Array<{ mime: string; signatures: Array<number[]>; offset?: number }> = [
  { mime: 'image/jpeg', signatures: [[0xff, 0xd8, 0xff]] },
  { mime: 'image/png',  signatures: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]] },
  { mime: 'image/webp', signatures: [[0x52, 0x49, 0x46, 0x46]] }, // RIFF (WebP validado abaixo)
  { mime: 'image/heic', signatures: [
    [0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63], // ftypheic
    [0x66, 0x74, 0x79, 0x70, 0x6d, 0x69, 0x66, 0x31], // ftypmif1
    [0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x78], // ftypheix
  ], offset: 4 },
];

export interface ValidationResult {
  ok:     boolean;
  mime?:  string;
  code?:  'FILE_TOO_LARGE' | 'EMPTY_FILE' | 'INVALID_EXTENSION' | 'INVALID_MIME' | 'MIME_MISMATCH';
  message?: string;
}

export function detectMimeFromBytes(buffer: Buffer): string | null {
  for (const entry of MAGIC_BYTES) {
    for (const sig of entry.signatures) {
      const offset = entry.offset ?? 0;
      if (buffer.length < offset + sig.length) continue;
      let match = true;
      for (let i = 0; i < sig.length; i++) {
        if (buffer[offset + i] !== sig[i]) { match = false; break; }
      }
      if (match) {
        if (entry.mime === 'image/webp') {
          // RIFF.... WEBP (bytes 8-11)
          const webp = buffer.slice(8, 12).toString('ascii');
          if (webp === 'WEBP') return 'image/webp';
          continue;
        }
        return entry.mime;
      }
    }
  }
  return null;
}

/**
 * Remove caracteres de path traversal e normaliza nome para armazenamento.
 * Nunca usar o nome do cliente diretamente como objectKey — apenas como metadata.
 */
export function sanitizeFilename(rawName: string): string {
  const base = path.basename(rawName).normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const safe = base
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 120);
  return safe || 'upload.jpg';
}

export function validateImageUpload(
  buffer: Buffer,
  originalName: string,
  declaredMime: string,
): ValidationResult {
  if (buffer.length === 0) {
    return { ok: false, code: 'EMPTY_FILE', message: 'Arquivo vazio.' };
  }
  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    return {
      ok: false,
      code: 'FILE_TOO_LARGE',
      message: `Arquivo excede o limite de ${Math.round(MAX_IMAGE_SIZE_BYTES / (1024 * 1024))}MB.`,
    };
  }

  const ext = path.extname(originalName).toLowerCase();
  if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext as (typeof ALLOWED_IMAGE_EXTENSIONS)[number])) {
    return {
      ok: false,
      code: 'INVALID_EXTENSION',
      message: `Extensão não suportada. Use ${ALLOWED_IMAGE_EXTENSIONS.join(', ')}.`,
    };
  }

  const detected = detectMimeFromBytes(buffer);
  if (!detected) {
    return {
      ok: false,
      code: 'INVALID_MIME',
      message: 'Arquivo não é uma imagem válida (assinatura desconhecida).',
    };
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.includes(detected as (typeof ALLOWED_IMAGE_MIME_TYPES)[number])) {
    return {
      ok: false,
      code: 'INVALID_MIME',
      message: `Tipo de imagem ${detected} não é permitido.`,
    };
  }

  // MIME declarado pelo cliente deve ser consistente com os bytes — divergência = suspeita
  if (declaredMime && declaredMime !== detected) {
    const normalized = declaredMime.toLowerCase();
    const detectedLc  = detected.toLowerCase();
    // jpg/jpeg alias permitido
    const isAlias =
      (normalized === 'image/jpg' && detectedLc === 'image/jpeg') ||
      (normalized === 'image/pjpeg' && detectedLc === 'image/jpeg');
    if (!isAlias) {
      return {
        ok: false,
        code: 'MIME_MISMATCH',
        message: 'Conteúdo do arquivo não bate com o tipo declarado.',
      };
    }
  }

  return { ok: true, mime: detected };
}
