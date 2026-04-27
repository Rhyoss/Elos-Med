# syntax=docker/dockerfile:1
# Contexto de build: raiz do repositório (.)
# Uso: docker build -f apps/worker/Dockerfile -t dermaos-worker .

# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/shared/package.json     ./packages/shared/
COPY packages/ui/package.json         ./packages/ui/
COPY apps/api/package.json            ./apps/api/
COPY apps/web/package.json            ./apps/web/
COPY apps/worker/package.json         ./apps/worker/
COPY apps/patient-portal/package.json ./apps/patient-portal/

RUN npm install -g pnpm@9.15.0 --quiet && \
    pnpm install --frozen-lockfile

# ─── Stage 2: builder ─────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm@9.15.0 --quiet

COPY --from=deps /app/node_modules ./node_modules

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/shared/ ./packages/shared/
COPY apps/worker/     ./apps/worker/

RUN pnpm --filter @dermaos/shared run build --if-present && \
    pnpm --filter @dermaos/worker  run build

RUN pnpm prune --prod

# ─── Stage 3: runner (distroless — sem shell) ─────────────────────────────────
FROM gcr.io/distroless/nodejs22-debian12 AS runner
WORKDIR /app

COPY --from=builder /app/apps/worker/dist ./dist
COPY --from=builder /app/node_modules     ./node_modules
COPY --from=builder /app/packages/shared  ./packages/shared
COPY --from=builder /app/apps/worker/package.json ./package.json

USER nonroot

ENV NODE_ENV=production

# Health check: verifica arquivo de heartbeat que o worker atualiza a cada 60s.
# O código do worker deve fazer: fs.utimesSync('/tmp/worker-heartbeat', now, now)
# Falha se o arquivo não foi atualizado nos últimos 2 minutos (120000ms).
HEALTHCHECK --interval=60s --timeout=5s --start-period=30s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", \
       "const fs=require('fs');try{const s=fs.statSync('/tmp/worker-heartbeat');process.exit(Date.now()-s.mtimeMs>120000?1:0)}catch(e){process.exit(1)}"]

CMD ["dist/index.js"]
