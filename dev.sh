#!/bin/bash
set -e

DC="docker compose -f docker-compose.dev.yml"

case "$1" in
  up)       $DC up "${@:2}" ;;
  build)    $DC up --build "${@:2}" ;;
  down)     $DC down "${@:2}" ;;
  logs)     $DC logs -f "${@:2}" ;;
  ps)       $DC ps ;;

  migrate)  $DC exec api pnpm prisma migrate dev ;;
  generate) $DC exec api pnpm prisma generate ;;
  studio)   $DC exec api pnpm prisma studio --port 5556 --browser none ;;
  seed)     $DC exec api pnpm prisma db seed ;;

  test)     $DC exec api pnpm test ;;
  lint)     $DC exec api pnpm lint ;;

  shell)
    SERVICE=${2:-api}
    $DC exec "$SERVICE" sh
    ;;

  reset)
    echo "ADVERTENCIA: esto borrará todos los datos de desarrollo."
    read -p "¿Confirmar? (s/N): " -r REPLY
    if [[ $REPLY =~ ^[Ss]$ ]]; then
      $DC down -v
      $DC up --build
    fi
    ;;

  *)
    echo "Uso: ./dev.sh <comando> [opciones]"
    echo ""
    echo "  up [flags]    Iniciar servicios"
    echo "  build         Iniciar con rebuild de imágenes"
    echo "  down          Detener servicios"
    echo "  logs [svc]    Ver logs en tiempo real"
    echo "  ps            Estado de los servicios"
    echo ""
    echo "  migrate       prisma migrate dev"
    echo "  generate      prisma generate"
    echo "  studio        Prisma Studio en :5556"
    echo "  seed          prisma db seed"
    echo ""
    echo "  test          Correr tests"
    echo "  lint          Correr lint"
    echo "  shell [svc]   Shell interactivo (default: api)"
    echo ""
    echo "  reset         ⚠️  Borrar volúmenes y reconstruir"
    ;;
esac
