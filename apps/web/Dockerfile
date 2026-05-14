# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# NEXT_PUBLIC_* se hornean en el bundle — deben pasarse como ARG en build time
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_MP_SANDBOX=false
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_MP_SANDBOX=$NEXT_PUBLIC_MP_SANDBOX

COPY apps/web/package.json ./
RUN pnpm install --no-frozen-lockfile --ignore-scripts

COPY apps/web/ ./
RUN pnpm build

# ── Stage 2: Runtime (Next.js standalone) ─────────────────────────────────────
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# standalone contiene todo lo necesario para correr sin node_modules
# (apps/web no tiene carpeta public/ — si se agregara en el futuro, descomentar la línea)
COPY --from=builder /app/.next/standalone/ ./
COPY --from=builder /app/.next/static/ ./.next/static/

EXPOSE 3000
CMD ["node", "server.js"]
