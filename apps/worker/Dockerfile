# ─── Builder ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/worker/package.json ./apps/worker/

RUN pnpm install --frozen-lockfile

COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/
COPY apps/worker/src ./apps/worker/src
COPY apps/worker/tsconfig.json ./apps/worker/

WORKDIR /app/apps/worker
RUN pnpm build

# ─── Runner ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN addgroup --system --gid 1001 dermaos && \
    adduser --system --uid 1001 --ingroup dermaos dermaos

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=builder /app/apps/worker/package.json ./
RUN pnpm install --prod

COPY --from=builder /app/apps/worker/dist ./dist

USER dermaos

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
