/**
 * Endpoint REST para upload de documentos da knowledge base da Aurora.
 *
 * Fluxo (§1.2 e §3.3 do prompt Fase 4):
 *   1. Frontend envia o arquivo (.txt / .md / .pdf / .docx, ≤ 5MB).
 *   2. Extraímos o texto aqui (pdf-parse / mammoth / utf-8).
 *   3. Persistimos em `omni.ai_knowledge_base` com metadata.embedding_status = 'pending'.
 *   4. Devolvemos um preview (documentId + texto extraído + metadados) para o
 *      usuário revisar no frontend. O embedding só é enfileirado depois, quando
 *      o usuário confirma via `aurora.admin.confirmEmbedding` (tRPC).
 *
 * tRPC não suporta multipart — mantemos este endpoint REST autenticado pelo
 * mesmo cookie JWT.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import {
  checkPermission,
  getPermissionsForRole,
  type UserRole,
  type UploadPreview,
} from '@dermaos/shared';
import type { JwtUser } from '../../auth/auth.types.js';
import { createKnowledgeDraft, getAgent } from './aurora-admin.service.js';
import { logger } from '../../../lib/logger.js';

const MAX_FILE_BYTES = 5 * 1024 * 1024;           // 5 MB
const MAX_EXTRACTED_CHARS = 50_000;               // bate com uploadPreviewSchema
const ALLOWED_MIME_TYPES = new Set<string>([
  'text/plain',
  'text/markdown',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const ALLOWED_EXTENSIONS = new Set(['.txt', '.md', '.pdf', '.docx']);

interface UploadParams { agentId: string }

function extensionOf(filename: string): string {
  const i = filename.lastIndexOf('.');
  return i >= 0 ? filename.slice(i).toLowerCase() : '';
}

function prettyTitleFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '');
  return base.replace(/[_-]+/g, ' ').trim().slice(0, 200) || 'Documento sem título';
}

async function extractText(
  buffer: Buffer,
  mime: string,
  filename: string,
): Promise<string> {
  const ext = extensionOf(filename);
  if (mime === 'application/pdf' || ext === '.pdf') {
    const mod = (await import('pdf-parse')) as unknown as
      | { default: (b: Buffer) => Promise<{ text: string }> }
      | ((b: Buffer) => Promise<{ text: string }>);
    const pdfParse = (typeof mod === 'function' ? mod : mod.default) as (
      b: Buffer,
    ) => Promise<{ text: string }>;
    const out = await pdfParse(buffer);
    return out.text ?? '';
  }
  if (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === '.docx'
  ) {
    const mammoth = (await import('mammoth')) as {
      extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
    };
    const out = await mammoth.extractRawText({ buffer });
    return out.value ?? '';
  }
  // .txt / .md → utf-8 bruto
  return buffer.toString('utf8');
}

export async function registerAuroraKnowledgeUploadRoute(
  app: FastifyInstance,
): Promise<void> {
  if (!app.hasContentTypeParser('multipart/form-data')) {
    await app.register(fastifyMultipart, {
      limits: {
        fileSize:  MAX_FILE_BYTES,
        files:     1,
        fieldSize: 8 * 1024,
        fields:    10,
      },
    });
  }

  app.post<{ Params: UploadParams }>(
    '/api/v1/ai-agents/:agentId/knowledge/upload',
    async (req: FastifyRequest<{ Params: UploadParams }>, reply: FastifyReply) => {
      let user: JwtUser;
      try {
        user = await req.jwtVerify<JwtUser>();
      } catch {
        return reply.status(401).send({
          code: 'UNAUTHORIZED',
          message: 'Autenticação necessária.',
        });
      }

      if (!user.clinicId) {
        return reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Clínica não identificada.' });
      }

      const perms = getPermissionsForRole(user.role as UserRole);
      if (!checkPermission(perms, 'omni', 'ai_config')) {
        return reply.status(403).send({
          code:    'FORBIDDEN',
          message: 'Permissão insuficiente: omni.ai_config',
        });
      }

      const { agentId } = req.params;
      try {
        await getAgent(user.clinicId, agentId);
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        const status = code === 'NOT_FOUND' ? 404 : 400;
        return reply.status(status).send({
          code: code ?? 'BAD_REQUEST',
          message: (err as { message?: string })?.message ?? 'Agente inválido.',
        });
      }

      let fileBuffer: Buffer | null = null;
      let filename = 'documento';
      let mimeType = 'application/octet-stream';

      try {
        const parts = req.parts();
        for await (const part of parts) {
          if (part.type === 'file') {
            if (fileBuffer) {
              return reply.status(400).send({
                code:    'TOO_MANY_FILES',
                message: 'Envie apenas um arquivo por vez.',
              });
            }
            const buf = await part.toBuffer();
            if (buf.length > MAX_FILE_BYTES) {
              return reply.status(413).send({
                code:    'FILE_TOO_LARGE',
                message: 'Arquivo excede 5MB.',
              });
            }
            filename = part.filename ?? filename;
            mimeType = part.mimetype ?? mimeType;
            fileBuffer = buf;
          }
          // Ignora fields — só aceitamos o arquivo aqui.
        }
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code === 'FST_REQ_FILE_TOO_LARGE') {
          return reply.status(413).send({
            code:    'FILE_TOO_LARGE',
            message: 'Arquivo excede 5MB.',
          });
        }
        logger.warn({ err }, 'aurora upload multipart parse failed');
        return reply.status(400).send({
          code:    'BAD_MULTIPART',
          message: 'Falha ao processar upload.',
        });
      }

      if (!fileBuffer) {
        return reply.status(400).send({
          code: 'NO_FILE',
          message: 'Nenhum arquivo recebido.',
        });
      }

      const ext = extensionOf(filename);
      if (!ALLOWED_MIME_TYPES.has(mimeType) && !ALLOWED_EXTENSIONS.has(ext)) {
        return reply.status(415).send({
          code:    'UNSUPPORTED_MEDIA_TYPE',
          message: 'Formato não suportado. Use .txt, .md, .pdf ou .docx.',
        });
      }

      let extracted: string;
      try {
        extracted = (await extractText(fileBuffer, mimeType, filename)).trim();
      } catch (err) {
        logger.warn({ err, filename, mimeType }, 'aurora knowledge: text extraction failed');
        return reply.status(422).send({
          code:    'EXTRACTION_FAILED',
          message: 'Não foi possível extrair texto do arquivo. Tente outro formato.',
        });
      }

      if (extracted.length === 0) {
        return reply.status(422).send({
          code:    'EMPTY_CONTENT',
          message: 'O arquivo não contém texto legível.',
        });
      }

      const truncated = extracted.length > MAX_EXTRACTED_CHARS;
      const content = truncated ? extracted.slice(0, MAX_EXTRACTED_CHARS) : extracted;

      try {
        const documentId = await createKnowledgeDraft(user.clinicId, agentId, {
          title:            prettyTitleFromFilename(filename),
          content,
          originalFilename: filename,
          mimeType,
          fileSizeBytes:    fileBuffer.length,
        });

        const preview: UploadPreview = {
          documentId,
          title:            prettyTitleFromFilename(filename),
          extractedText:    content,
          originalFilename: filename,
          fileSizeBytes:    fileBuffer.length,
          mimeType,
        };
        return reply.status(201).send({ preview, truncated });
      } catch (err: unknown) {
        logger.error({ err, agentId }, 'aurora knowledge: draft creation failed');
        const code = (err as { code?: string })?.code;
        const message = (err as { message?: string })?.message ?? 'Falha ao salvar documento.';
        const statusMap: Record<string, number> = {
          BAD_REQUEST: 400, NOT_FOUND: 404, FORBIDDEN: 403, UNAUTHORIZED: 401,
        };
        const status = code && statusMap[code] ? statusMap[code] : 500;
        return reply.status(status).send({ code: code ?? 'UPLOAD_FAILED', message });
      }
    },
  );
}
