# ─── Builder ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/

RUN pnpm install --frozen-lockfile

COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json packages/shared/tsconfig.build.json ./packages/shared/
COPY apps/api/src ./apps/api/src
COPY apps/api/tsconfig.json ./apps/api/
COPY apps/worker/src ./apps/worker/src
COPY apps/worker/tsconfig.json apps/worker/tsconfig.build.json ./apps/worker/

WORKDIR /app/packages/shared
RUN pnpm build && \
    node -e "const p=require('./package.json'); p.main='./dist/index.js'; p.types='./dist/index.d.ts'; p.exports={'.':'./dist/index.js'}; require('fs').writeFileSync('package.json',JSON.stringify(p,null,2))"

WORKDIR /app/apps/worker
RUN pnpm build

# ─── Runner ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN apk add --no-cache tini && \
    addgroup --system --gid 1001 dermaos && \
    adduser --system --uid 1001 --ingroup dermaos dermaos

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=builder /app/apps/worker/package.json ./
RUN pnpm install --prod

COPY --from=builder /app/apps/worker/dist ./dist

USER dermaos

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE ${PORT}

ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/index.js"]
