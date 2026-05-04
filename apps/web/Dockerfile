# ─── Builder ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile

COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json packages/shared/tsconfig.build.json ./packages/shared/
COPY packages/ui/src ./packages/ui/src
COPY packages/ui/tsconfig.json ./packages/ui/
COPY apps/web/src ./apps/web/src
COPY apps/web/next.config.ts ./apps/web/
COPY apps/web/tailwind.config.ts ./apps/web/
COPY apps/web/tsconfig.json ./apps/web/
COPY apps/web/public ./apps/web/public

WORKDIR /app/apps/web

ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* vars must be inlined at build time; pass via --build-arg to override
ARG NEXT_PUBLIC_API_URL=https://api.elosmed.com.br
ARG NEXT_PUBLIC_WS_URL=wss://api.elosmed.com.br
ARG NEXT_PUBLIC_STORAGE_URL=https://storage.googleapis.com
ARG NEXT_PUBLIC_APP_NAME=ElosMed
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_STORAGE_URL=$NEXT_PUBLIC_STORAGE_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME

RUN pnpm build

# ─── Runner ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN apk add --no-cache tini && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE ${PORT}

ENTRYPOINT ["tini", "--"]
CMD ["node", "apps/web/server.js"]
