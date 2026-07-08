# Build from the repo root: docker build -f docker/Dockerfile -t mochi .
FROM node:24-alpine AS builder
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @mochi/web...

COPY apps/web apps/web
RUN pnpm --filter @mochi/web build

FROM node:24-alpine AS runner
ENV NODE_ENV=production
ENV MIGRATE_ON_START=1
ENV RETENTION_CLEANUP=1
WORKDIR /app

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/drizzle ./apps/web/drizzle
COPY --from=builder /app/apps/web/clickhouse ./apps/web/clickhouse

WORKDIR /app/apps/web
EXPOSE 3000
CMD ["node", "server.js"]
