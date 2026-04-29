import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { JwtUser } from '../auth/auth.types.js';
import { uploadLogo } from './clinic/clinic.service.js';
import { logger } from '../../lib/logger.js';

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB

export async function registerClinicLogoUploadRoute(app: FastifyInstance): Promise<void> {
  if (!app.hasContentTypeParser('multipart/form-data')) {
    const fastifyMultipart = await import('@fastify/multipart');
    await app.register(fastifyMultipart.default, {
      limits: { fileSize: MAX_LOGO_BYTES, files: 1, fields: 5 },
    });
  }

  app.post(
    '/api/settings/clinic/logo',
    async (req: FastifyRequest, reply: FastifyReply) => {
      let user: JwtUser;
      try {
        user = await req.accessJwtVerify<JwtUser>();
      } catch {
        return reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Autenticação necessária.' });
      }

      if (!user.clinicId) {
        return reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Clínica não identificada.' });
      }

      if (user.role !== 'owner' && user.role !== 'admin') {
        return reply.status(403).send({ code: 'FORBIDDEN', message: 'Apenas owner ou admin podem alterar o logo.' });
      }

      let fileBuffer: Buffer | null = null;
      let fileMime = 'application/octet-stream';

      try {
        const parts = req.parts();
        for await (const part of parts) {
          if (part.type === 'file' && !fileBuffer) {
            fileBuffer = await part.toBuffer();
            fileMime   = part.mimetype ?? fileMime;
          }
        }
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code === 'FST_REQ_FILE_TOO_LARGE') {
          return reply.status(413).send({ code: 'FILE_TOO_LARGE', message: 'Logo excede 2MB.' });
        }
        logger.warn({ err }, 'Logo multipart parse failed');
        return reply.status(400).send({ code: 'BAD_MULTIPART', message: 'Falha ao processar upload.' });
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        return reply.status(400).send({ code: 'NO_FILE', message: 'Nenhum arquivo recebido.' });
      }

      try {
        const result = await uploadLogo(user.clinicId, user.sub, fileBuffer, fileMime);
        return reply.status(200).send(result);
      } catch (err: unknown) {
        const trpcCode = (err as { code?: string })?.code;
        const message  = (err as { message?: string })?.message ?? 'Falha no upload.';
        const statusMap: Record<string, number> = {
          BAD_REQUEST: 400, NOT_FOUND: 404, FORBIDDEN: 403,
          UNAUTHORIZED: 401, INTERNAL_SERVER_ERROR: 500,
        };
        const status = trpcCode && statusMap[trpcCode] ? statusMap[trpcCode] : 500;
        if (status === 500) logger.error({ err }, 'Logo upload error');
        return reply.status(status).send({ code: trpcCode ?? 'UPLOAD_FAILED', message });
      }
    },
  );
}
