# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copiar manifiesto y schema de Prisma antes de instalar
COPY apps/api/package.json ./
COPY prisma/ ./prisma/

# --ignore-scripts evita el postinstall (prisma generate lo corremos manual)
RUN pnpm install --no-frozen-lockfile --ignore-scripts
RUN pnpm exec prisma generate

# Copiar fuente y compilar
COPY apps/api/ ./
RUN pnpm build

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/dist/ ./dist/
COPY --from=builder /app/node_modules/ ./node_modules/
COPY --from=builder /app/prisma/ ./prisma/
COPY --from=builder /app/package.json ./

EXPOSE 3001
CMD ["node", "dist/main"]
