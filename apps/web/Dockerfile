# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# NEXT_PUBLIC_* vars se hornean en el build — deben pasarse como ARGs
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_MP_SANDBOX=false
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_MP_SANDBOX=$NEXT_PUBLIC_MP_SANDBOX

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/ packages/
COPY apps/web/ apps/web/

RUN pnpm install --frozen-lockfile
RUN pnpm --filter web build

# ── Stage 2: Runtime (Next.js standalone) ─────────────────────────────────────
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app/apps/web/.next/standalone/ ./
COPY --from=builder /app/apps/web/.next/static/ ./apps/web/.next/static/
COPY --from=builder /app/apps/web/public/ ./apps/web/public/

EXPOSE 3000
# En monorepo pnpm, standalone genera server.js relativo a la raíz del workspace
CMD ["node", "apps/web/server.js"]
