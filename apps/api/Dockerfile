# ─── Builder ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile --filter @dermaos/api...

COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json packages/shared/tsconfig.build.json ./packages/shared/
COPY apps/api/src ./apps/api/src
COPY apps/api/tsconfig.json apps/api/tsconfig.build.json ./apps/api/

WORKDIR /app/packages/shared
RUN pnpm build && \
    node -e "const p=require('./package.json'); p.main='./dist/index.js'; p.types='./dist/index.d.ts'; p.exports={'.':'./dist/index.js'}; require('fs').writeFileSync('package.json',JSON.stringify(p,null,2))"

WORKDIR /app/apps/api
RUN pnpm build

# ─── Runner ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN apk add --no-cache tini && \
    addgroup --system --gid 1001 dermaos && \
    adduser --system --uid 1001 --ingroup dermaos dermaos

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=builder /app/apps/api/package.json ./
RUN node -e "const p=require('./package.json'); delete p.dependencies['@dermaos/shared']; require('fs').writeFileSync('package.json',JSON.stringify(p,null,2))" && \
    pnpm install --prod --no-frozen-lockfile

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/packages/shared/package.json ./node_modules/@dermaos/shared/package.json
COPY --from=builder /app/packages/shared/dist ./node_modules/@dermaos/shared/dist

# SQL migrations — lidas por dist/db/migrate.js em tempo de execução
COPY db/init/*.sql ./db/init/

USER dermaos

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE ${PORT}

ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/index.js"]
