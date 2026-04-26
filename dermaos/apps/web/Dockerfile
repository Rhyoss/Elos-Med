# syntax=docker/dockerfile:1
# Contexto de build: raiz do repositório (.)
# Uso: docker build -f apps/web/Dockerfile -t dermaos-web .

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
COPY packages/ui/     ./packages/ui/
COPY apps/web/        ./apps/web/

# Não enviar telemetria para Vercel durante build
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter @dermaos/shared run build --if-present && \
    pnpm --filter @dermaos/ui     run build --if-present && \
    pnpm --filter @dermaos/web    run build

# ─── Stage 3: runner ──────────────────────────────────────────────────────────
# Next.js standalone não é compatível com distroless — usa node:22-alpine
FROM node:22-alpine AS runner
WORKDIR /app

# Usuário não-root dedicado
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# .next/standalone já inclui server.js + node_modules mínimos (self-contained)
COPY --from=builder --chown=appuser:appgroup \
     /app/apps/web/.next/standalone ./
COPY --from=builder --chown=appuser:appgroup \
     /app/apps/web/.next/static ./.next/static
COPY --from=builder --chown=appuser:appgroup \
     /app/apps/web/public ./public

USER appuser

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# wget disponível no alpine
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
