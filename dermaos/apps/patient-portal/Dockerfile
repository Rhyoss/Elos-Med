# syntax=docker/dockerfile:1
# Contexto de build: raiz do repositório (.)
# Uso: docker build -f apps/patient-portal/Dockerfile -t dermaos-portal .

# ─── Stage 1: builder ─────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/shared/package.json     ./packages/shared/
COPY packages/ui/package.json         ./packages/ui/
COPY apps/api/package.json            ./apps/api/
COPY apps/web/package.json            ./apps/web/
COPY apps/worker/package.json         ./apps/worker/
COPY apps/patient-portal/package.json ./apps/patient-portal/

RUN pnpm install --no-frozen-lockfile

COPY packages/shared/     ./packages/shared/
COPY packages/ui/         ./packages/ui/
COPY apps/patient-portal/ ./apps/patient-portal/

ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter @dermaos/shared       run build --if-present && \
    pnpm --filter @dermaos/ui           run build --if-present && \
    pnpm --filter @dermaos/patient-portal run build

# ─── Stage 2: runner ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Em monorepo com pnpm, o standalone preserva a estrutura de pastas.
# O servidor fica em: apps/patient-portal/server.js dentro do standalone.
COPY --from=builder --chown=appuser:appgroup \
     /app/apps/patient-portal/.next/standalone /app
COPY --from=builder --chown=appuser:appgroup \
     /app/apps/patient-portal/.next/static \
     /app/apps/patient-portal/.next/static

WORKDIR /app/apps/patient-portal

USER appuser

EXPOSE 3002

ENV PORT=3002
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3002/api/health || exit 1

CMD ["node", "server.js"]
