import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'node:crypto';
import {
  checkPermission,
  getPermissionsForRole,
  type UserRole,
} from '@dermaos/shared';
import type { JwtUser } from '../auth/auth.types.js';
import { validateImageUpload, sanitizeFilename } from '../../lib/image-validation.js';
import { putObjectBuffer, PRODUCT_IMAGES_BUCKET } from '../../lib/storage.js';
import { logger } from '../../lib/logger.js';

const PRODUCT_PHOTO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function registerProductPhotoUploadRoute(app: FastifyInstance): Promise<void> {
  if (!app.hasContentTypeParser('multipart/form-data')) {
    const fastifyMultipart = await import('@fastify/multipart');
    await app.register(fastifyMultipart.default, {
      limits: {
        fileSize:  PRODUCT_PHOTO_MAX_BYTES,
        files:     1,
        fieldSize: 1024,
        fields:    5,
      },
    });
  }

  app.post(
    '/api/supply/products/photo',
    async (req: FastifyRequest, reply: FastifyReply) => {
      // ── Autenticação ──────────────────────────────────────────────────
      let user: JwtUser;
      try {
        user = await req.accessJwtVerify<JwtUser>();
      } catch {
        return reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Autenticação necessária.' });
      }

      if (!user.clinicId) {
        return reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Clínica não identificada.' });
      }

      // ── RBAC ─────────────────────────────────────────────────────────
      const perms = getPermissionsForRole(user.role as UserRole);
      if (!checkPermission(perms, 'supply', 'write')) {
        return reply.status(403).send({ code: 'FORBIDDEN', message: 'Permissão insuficiente: supply.write' });
      }

      // ── Parse multipart ──────────────────────────────────────────────
      let buffer: Buffer | null      = null;
      let originalName: string       = 'photo.jpg';
      let declaredMime: string       = 'image/jpeg';

      try {
        const parts = req.parts();
        for await (const part of parts) {
          if (part.type === 'file' && part.fieldname === 'photo') {
            buffer       = await part.toBuffer();
            originalName = part.filename ?? 'photo.jpg';
            declaredMime = part.mimetype ?? 'image/jpeg';
          }
        }
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code === 'FST_REQ_FILE_TOO_LARGE') {
          return reply.status(413).send({ code: 'FILE_TOO_LARGE', message: 'Foto excede 5MB.' });
        }
        logger.warn({ err }, 'product photo: multipart parse failed');
        return reply.status(400).send({ code: 'BAD_MULTIPART', message: 'Erro ao processar upload.' });
      }

      if (!buffer || buffer.length === 0) {
        return reply.status(400).send({ code: 'NO_FILE', message: 'Nenhum arquivo recebido no campo "photo".' });
      }

      // ── Validação de imagem (magic bytes) ────────────────────────────
      const validation = validateImageUpload(buffer, originalName, declaredMime);
      if (!validation.ok) {
        return reply.status(400).send({ code: validation.code, message: validation.message });
      }

      // ── Upload para MinIO ────────────────────────────────────────────
      const safeName  = sanitizeFilename(originalName);
      const objectKey = `${user.clinicId}/${randomUUID()}/${safeName}`;

      try {
        await putObjectBuffer(objectKey, buffer, validation.mime!, PRODUCT_IMAGES_BUCKET);
      } catch (err) {
        logger.error({ err, objectKey }, 'product photo: MinIO put failed');
        return reply.status(500).send({ code: 'STORAGE_ERROR', message: 'Falha ao armazenar a imagem.' });
      }

      return reply.status(200).send({ objectKey });
    },
  );
}
