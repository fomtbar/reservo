# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/ packages/
COPY apps/api/ apps/api/
COPY prisma/ prisma/

RUN pnpm install --frozen-lockfile
RUN pnpm --filter api exec prisma generate
RUN pnpm --filter api build

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/ ./packages/
COPY --from=builder /app/apps/api/dist/ ./apps/api/dist/
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/node_modules/ ./apps/api/node_modules/
COPY --from=builder /app/node_modules/ ./node_modules/
COPY --from=builder /app/prisma/ ./prisma/

WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/main"]
