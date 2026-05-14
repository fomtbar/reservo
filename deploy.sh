#!/usr/bin/env bash
# deploy.sh — Instalación inicial de Reservo en VPS (single-tenant, acceso por IP)
# Uso: bash deploy.sh
set -euo pipefail

# ── Colores ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${BLUE}▶${NC} $*"; }
success() { echo -e "${GREEN}✔${NC} $*"; }
warn()    { echo -e "${YELLOW}⚠${NC} $*"; }
error()   { echo -e "${RED}✖ ERROR:${NC} $*" >&2; exit 1; }
title()   { echo -e "\n${BOLD}${BLUE}══ $* ══${NC}\n"; }

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE="docker compose -f $REPO_DIR/docker-compose.prod.yml"
ENV_FILE="$REPO_DIR/.env.prod"

# ── 1. Requisitos ─────────────────────────────────────────────────────────────
title "Verificando requisitos"

command -v docker   >/dev/null 2>&1 || error "Docker no está instalado."
docker compose version >/dev/null 2>&1 || error "El plugin 'docker compose' no está disponible."
command -v openssl  >/dev/null 2>&1 || error "openssl no está disponible (necesario para generar secrets)."
command -v git      >/dev/null 2>&1 || error "Git no está instalado."

success "Docker $(docker --version | awk '{print $3}' | tr -d ',')"
success "Docker Compose $(docker compose version --short)"

# ── 2. Configuración del entorno ──────────────────────────────────────────────
title "Configuración del entorno"

if [[ -f "$ENV_FILE" ]]; then
  warn ".env.prod ya existe. ¿Sobreescribir? [s/N]"
  read -r OVERWRITE
  [[ "$OVERWRITE" =~ ^[sS]$ ]] || { info "Usando .env.prod existente."; }
fi

if [[ ! -f "$ENV_FILE" ]] || [[ "${OVERWRITE:-}" =~ ^[sS]$ ]]; then
  echo ""
  info "Ingresá la IP de esta VPS (ej: 192.168.1.50):"
  read -r VPS_IP
  [[ -n "$VPS_IP" ]] || error "La IP no puede estar vacía."

  info "Email del admin inicial [admin@reservo.local]:"
  read -r ADMIN_EMAIL
  ADMIN_EMAIL="${ADMIN_EMAIL:-admin@reservo.local}"

  info "Password del admin inicial (mín. 8 caracteres):"
  read -rs ADMIN_PASS; echo
  [[ ${#ADMIN_PASS} -ge 8 ]] || error "El password debe tener al menos 8 caracteres."

  info "Password de la base de datos (Enter para generar uno aleatorio):"
  read -rs DB_PASS; echo
  DB_PASS="${DB_PASS:-$(openssl rand -hex 16)}"

  info "Generando secrets criptográficos..."
  JWT_SECRET=$(openssl rand -hex 32)
  JWT_REFRESH_SECRET=$(openssl rand -hex 32)
  AUTH_SECRET=$(openssl rand -hex 32)
  MASTER_KEY=$(openssl rand -hex 16)   # exactamente 32 caracteres hex

  cat > "$ENV_FILE" <<EOF
# ── PostgreSQL ────────────────────────────────────────────────────────────────
POSTGRES_USER=reservo
POSTGRES_PASSWORD=${DB_PASS}
POSTGRES_DB=reservo_prod
DATABASE_URL=postgresql://reservo:${DB_PASS}@db:5432/reservo_prod

# ── Redis ─────────────────────────────────────────────────────────────────────
REDIS_URL=redis://redis:6379

# ── API (NestJS) ──────────────────────────────────────────────────────────────
PORT=3001
NODE_ENV=production
LOG_LEVEL=info
CORS_ORIGIN=http://${VPS_IP}:3000
APP_API_URL=http://${VPS_IP}:3001

# ── JWT ───────────────────────────────────────────────────────────────────────
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_REFRESH_EXPIRES_IN=7d

# ── Encryption ────────────────────────────────────────────────────────────────
MASTER_KEY=${MASTER_KEY}

# ── NextAuth / Next.js ────────────────────────────────────────────────────────
AUTH_SECRET=${AUTH_SECRET}
NEXTAUTH_URL=http://${VPS_IP}:3000
API_URL=http://api:3001/api
NEXT_PUBLIC_API_URL=http://${VPS_IP}:3001/api

# ── Mercado Pago ──────────────────────────────────────────────────────────────
NEXT_PUBLIC_MP_SANDBOX=false

# ── Seed del admin ────────────────────────────────────────────────────────────
SEED_ADMIN_EMAIL=${ADMIN_EMAIL}
SEED_ADMIN_PASSWORD=${ADMIN_PASS}
EOF

  chmod 600 "$ENV_FILE"
  success ".env.prod creado (permisos 600)"
fi

# Exportar todas las vars del .env.prod al shell para que docker compose las vea
# (set -a marca todo lo que siga como exportado automáticamente)
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# ── 3. Build de imágenes ──────────────────────────────────────────────────────
title "Construyendo imágenes Docker"
info "Este paso puede tardar 5-10 minutos la primera vez..."

$COMPOSE build --progress=plain
success "Imágenes construidas"

# ── 4. Levantar DB y Redis ────────────────────────────────────────────────────
title "Iniciando base de datos y Redis"

$COMPOSE up -d db redis
info "Esperando a que PostgreSQL esté listo..."

RETRIES=30
until $COMPOSE exec -T db pg_isready -U reservo -d reservo_prod -q 2>/dev/null; do
  RETRIES=$((RETRIES - 1))
  [[ $RETRIES -le 0 ]] && error "PostgreSQL no responde después de 30 intentos."
  sleep 2
done
success "PostgreSQL listo"

# ── 5. Migraciones ────────────────────────────────────────────────────────────
title "Aplicando migraciones de Prisma"

$COMPOSE run --rm \
  -e DATABASE_URL="$DATABASE_URL" \
  api npx prisma migrate deploy \
  || error "Las migraciones fallaron. Revisá los logs con: $COMPOSE logs api"

success "Migraciones aplicadas"

# ── 6. Seed del admin ─────────────────────────────────────────────────────────
title "Creando usuario admin inicial"

$COMPOSE run --rm \
  -e DATABASE_URL="$DATABASE_URL" \
  -e SEED_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" \
  -e SEED_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" \
  api npx prisma db seed \
  || error "El seed falló. Revisá los logs con: $COMPOSE logs api"

success "Seed completado"

# ── 7. Levantar todo ──────────────────────────────────────────────────────────
title "Iniciando todos los servicios"

$COMPOSE up -d
sleep 4   # darle un momento a la API para que arranque

$COMPOSE ps
echo ""

# ── 8. Resumen ────────────────────────────────────────────────────────────────
title "Despliegue completado"

VPS_IP_SHOWN="${VPS_IP:-$(grep NEXTAUTH_URL "$ENV_FILE" | grep -oP '(?<=http://)[^:]+')}"

echo -e "  ${BOLD}Panel de administración:${NC}  http://${VPS_IP_SHOWN}:3000"
echo -e "  ${BOLD}API:${NC}                       http://${VPS_IP_SHOWN}:3001/api/health"
echo -e "  ${BOLD}Usuario admin:${NC}             $(grep SEED_ADMIN_EMAIL "$ENV_FILE" | cut -d= -f2)"
echo ""
echo -e "  ${YELLOW}Para ver los logs:${NC}"
echo -e "  docker compose -f $REPO_DIR/docker-compose.prod.yml logs -f"
echo ""
success "¡Listo!"
