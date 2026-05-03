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

COPY --from=builder /app/apps/web/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./.next/static

USER nextjs

EXPOSE ${PORT}

ENTRYPOINT ["tini", "--"]
CMD ["node", "server.js"]
