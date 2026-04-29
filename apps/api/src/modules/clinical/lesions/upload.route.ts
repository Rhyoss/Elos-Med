import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import { ZodError } from 'zod';
import {
  MAX_IMAGE_SIZE_BYTES,
  MAX_UPLOAD_BATCH_SIZE,
  uploadImageMetadataSchema,
  ALLOWED_IMAGE_MIME_TYPES,
} from '@dermaos/shared';
import {
  checkPermission,
  getPermissionsForRole,
  type UserRole,
} from '@dermaos/shared';
import type { JwtUser } from '../../auth/auth.types.js';
import {
  uploadImagesForLesion,
  type UploadedFile,
} from './lesion-images.service.js';
import { logger } from '../../../lib/logger.js';

/**
 * tRPC não suporta multipart nativamente — expomos um endpoint REST
 * autenticado pelo mesmo JWT httpOnly cookie.
 */
export async function registerLesionUploadRoute(app: FastifyInstance): Promise<void> {
  // Apenas registra multipart uma vez
  if (!app.hasContentTypeParser('multipart/form-data')) {
    await app.register(fastifyMultipart, {
      limits: {
        fileSize:  MAX_IMAGE_SIZE_BYTES,
        files:     MAX_UPLOAD_BATCH_SIZE,
        fieldSize: 8 * 1024,
        fields:    20,
      },
    });
  }

  app.post(
    '/api/clinical/lesion-images/upload',
    async (req: FastifyRequest, reply: FastifyReply) => {
      // ── Autenticação via cookie JWT ─────────────────────────────────
      let user: JwtUser;
      try {
        user = await req.accessJwtVerify<JwtUser>();
      } catch {
        return reply.status(401).send({
          code:    'UNAUTHORIZED',
          message: 'Autenticação necessária para upload de imagens.',
        });
      }

      if (!user.clinicId) {
        return reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Clínica não identificada.' });
      }

      // ── RBAC: mesma verificação do tRPC clinical.write ─────────────
      const perms = getPermissionsForRole(user.role as UserRole);
      if (!checkPermission(perms, 'clinical', 'write')) {
        return reply.status(403).send({
          code:    'FORBIDDEN',
          message: 'Permissão insuficiente: clinical.write',
        });
      }

      // ── Parse multipart ─────────────────────────────────────────────
      const files:   UploadedFile[] = [];
      const fields:  Record<string, string> = {};

      try {
        const parts = req.parts();
        for await (const part of parts) {
          if (part.type === 'file') {
            if (files.length >= MAX_UPLOAD_BATCH_SIZE) {
              return reply.status(400).send({
                code:    'TOO_MANY_FILES',
                message: `Máximo de ${MAX_UPLOAD_BATCH_SIZE} imagens por upload.`,
              });
            }
            const buffer = await part.toBuffer();
            if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
              return reply.status(413).send({
                code:    'FILE_TOO_LARGE',
                message: 'Arquivo excede 25MB.',
              });
            }
            files.push({
              buffer,
              originalName: part.filename ?? 'upload.jpg',
              mimeType:     part.mimetype ?? 'application/octet-stream',
            });
          } else if (part.type === 'field') {
            if (typeof part.value === 'string') {
              fields[part.fieldname] = part.value;
            }
          }
        }
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code === 'FST_REQ_FILE_TOO_LARGE') {
          return reply.status(413).send({
            code:    'FILE_TOO_LARGE',
            message: 'Arquivo excede 25MB.',
          });
        }
        logger.warn({ err }, 'multipart parse failed');
        return reply.status(400).send({
          code:    'BAD_MULTIPART',
          message: 'Falha ao processar upload multipart.',
        });
      }

      // ── Validação de metadata ──────────────────────────────────────
      const parsed = uploadImageMetadataSchema.safeParse(fields);
      if (!parsed.success) {
        return reply.status(400).send({
          code:    'INVALID_METADATA',
          message: 'Metadados de upload inválidos.',
          issues:  parsed.error.flatten().fieldErrors,
        });
      }

      if (files.length === 0) {
        return reply.status(400).send({
          code:    'NO_FILES',
          message: 'Nenhum arquivo recebido.',
        });
      }

      // Informativo — o service também valida magic bytes
      void ALLOWED_IMAGE_MIME_TYPES;

      try {
        const results = await uploadImagesForLesion(
          files,
          parsed.data,
          user.clinicId,
          user.sub,
        );
        return reply.status(202).send({ results });
      } catch (err: unknown) {
        if (err instanceof ZodError) {
          return reply.status(400).send({
            code:    'VALIDATION_ERROR',
            message: 'Dados inválidos.',
            issues:  err.flatten().fieldErrors,
          });
        }
        // TRPCError tem .code; traduz para HTTP
        const trpcCode = (err as { code?: string })?.code;
        const message  = (err as { message?: string })?.message ?? 'Falha no upload.';
        const statusMap: Record<string, number> = {
          BAD_REQUEST: 400, NOT_FOUND: 404, FORBIDDEN: 403, UNAUTHORIZED: 401,
          PRECONDITION_FAILED: 412, INTERNAL_SERVER_ERROR: 503,
        };
        const status = trpcCode && statusMap[trpcCode] ? statusMap[trpcCode] : 500;
        if (status === 500) {
          logger.error({ err }, 'Unexpected upload error');
        }
        return reply.status(status).send({ code: trpcCode ?? 'UPLOAD_FAILED', message });
      }
    },
  );
}
