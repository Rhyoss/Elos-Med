# ─── Builder ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Instala dependências primeiro (cache layer) — precisa dos package.jsons
# de TODOS os workspace members para o pnpm install --frozen-lockfile.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile --filter @dermaos/api...

# Copia e compila o código
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/
COPY apps/api/src ./apps/api/src
COPY apps/api/tsconfig.json ./apps/api/

WORKDIR /app/apps/api
RUN pnpm build

# ─── Runner ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN addgroup --system --gid 1001 dermaos && \
    adduser --system --uid 1001 --ingroup dermaos dermaos

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=builder /app/apps/api/package.json ./
RUN pnpm install --prod --frozen-lockfile 2>/dev/null || pnpm install --prod

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/packages/shared/dist ./node_modules/@dermaos/shared/dist

USER dermaos

EXPOSE 3001

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "dist/index.js"]
