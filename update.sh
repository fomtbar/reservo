#!/usr/bin/env bash
# update.sh — Actualizar Reservo en VPS tras un git pull
# Uso: bash update.sh
set -euo pipefail

BLUE='\033[0;34m'; GREEN='\033[0;32m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${BLUE}▶${NC} $*"; }
success() { echo -e "${GREEN}✔${NC} $*"; }
title()   { echo -e "\n${BOLD}${BLUE}══ $* ══${NC}\n"; }

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE="docker compose -f $REPO_DIR/docker-compose.prod.yml"
ENV_FILE="$REPO_DIR/.env.prod"

[[ -f "$ENV_FILE" ]] || { echo "No existe .env.prod. Ejecutá deploy.sh primero."; exit 1; }

# Exportar vars para que docker compose las vea como build args
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

title "Actualizando código"
git -C "$REPO_DIR" pull --ff-only
success "Código actualizado"

title "Re-construyendo imágenes"
$COMPOSE build --progress=plain api web
success "Imágenes listas"

title "Aplicando migraciones"
$COMPOSE run --rm api npx prisma migrate deploy
success "Migraciones aplicadas"

title "Reiniciando servicios"
$COMPOSE up -d
success "Servicios actualizados"

$COMPOSE ps
echo ""
success "Actualización completada"
