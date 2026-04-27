# syntax=docker/dockerfile:1
# Contexto de build: raiz do repositório (.)
# Uso: docker build -f apps/api/Dockerfile -t dermaos-api .

# ─── Stage 1: deps ────────────────────────────────────────────────────────────
# Instala APENAS dependências — layer cacheável; invalida só se lockfile mudar
FROM node:22-alpine AS deps
WORKDIR /app

# Copia todos os package.json do workspace para que pnpm resolva corretamente
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json     ./packages/ui/
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

# Reutiliza node_modules do stage anterior (camada cacheada)
COPY --from=deps /app/node_modules ./node_modules

# Manifestos e workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Pacotes compartilhados que a API depende
COPY packages/shared/ ./packages/shared/

# Fonte da API
COPY apps/api/ ./apps/api/

# Compila @dermaos/shared (se tiver script de build) e em seguida a API
RUN pnpm --filter @dermaos/shared run build --if-present && \
    pnpm --filter @dermaos/api   run build

# Remove devDependencies do workspace inteiro (reduz node_modules ~40%)
RUN pnpm prune --prod

# ─── Stage 3: runner (distroless — sem shell, sem package manager) ─────────────
# gcr.io/distroless/nodejs22-debian12: apenas Node.js runtime + nonroot user
FROM gcr.io/distroless/nodejs22-debian12 AS runner
WORKDIR /app

# Artefatos mínimos necessários para o runtime
COPY --from=builder /app/apps/api/dist  ./dist
COPY --from=builder /app/node_modules   ./node_modules
# packages/shared: alvo do symlink node_modules/@dermaos/shared → ../../packages/shared
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/api/package.json ./package.json

# distroless tem usuário nonroot (uid 65532) built-in
USER nonroot

EXPOSE 3001

ENV NODE_ENV=production

# distroless não tem curl/wget — health check via Node.js
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", \
       "require('http').get('http://localhost:3001/health',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"]

# ENTRYPOINT do distroless/nodejs é /nodejs/bin/node
CMD ["dist/index.js"]
