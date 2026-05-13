# Reservo — Estado del proyecto

> Última actualización: 2026-05-12
> Versión del plan original: `C:\Users\user\.claude\plans\en-modo-plan-solo-rosy-seal.md`

---

## Cómo levantar el entorno

```powershell
# Desde C:\proyectosDev\reservo
docker compose -f docker-compose.dev.yml up

# Si cambia schema.prisma:
docker compose -f docker-compose.dev.yml exec -T api pnpm prisma migrate dev --name <nombre>
docker compose -f docker-compose.dev.yml exec -T api pnpm prisma generate
docker compose -f docker-compose.dev.yml restart api

# Si cambian dependencias en package.json (web):
docker compose -f docker-compose.dev.yml stop web
docker rm reservo-web-dev
docker volume rm reservo_web_modules
docker compose -f docker-compose.dev.yml build web
docker compose -f docker-compose.dev.yml up -d web
```

**URLs en desarrollo:**
- Web (panel admin): http://localhost:4000
- API (NestJS):      http://localhost:4001/api
- Swagger:           http://localhost:4001/api/docs
- PostgreSQL:        localhost:5433
- Redis:             localhost:6380

> **Nota Windows:** Hot reload no funciona para archivos cambiados desde el host Windows.
> Solución: `docker compose -f docker-compose.dev.yml restart api` (o `web`) tras editar archivos.

---

## Fase 0 — Bootstrap ✅ Completa

- [x] Monorepo pnpm workspaces (`apps/api`, `apps/web`, `packages/`)
- [x] Docker Compose dev con red `reservo-dev`, volúmenes aislados, puertos no-estándar
- [x] PostgreSQL 16 + Redis 7 + NestJS 10 + Next.js 15 App Router
- [x] Prisma schema completo con todas las entidades
- [x] Migración inicial (`20260512133606_init`) con extensión `btree_gist` y constraint `EXCLUDE` de no-solapamiento
- [x] Auth backend: passport-local + passport-jwt, JWT 15min + refresh UUID 7d en Redis
- [x] Auth frontend: NextAuth v5 beta, Credentials provider, session con `accessToken` y `role`
- [x] Middleware Next.js: redirige `/` → `/courts`, protege rutas admin, redirige `/login` si ya autenticado
- [x] Layout admin: sidebar + topbar, rutas protegidas con `auth()` server-side
- [x] `apiFetch()` con detección server/client URL automática
- [x] TanStack Query v5 + react-hook-form + zod en el frontend
- [x] Tailwind v4 con CSS vars temáticas (`--color-primary`, `--color-sidebar`, etc.)
- [x] Componentes UI base: Button, Badge, Input, Label, Dialog, Switch, Textarea

---

## Fase 1 — MVP operativo

### Backend ✅ Completo

| Módulo | Endpoints principales | Estado |
|---|---|---|
| **Auth** | POST /auth/login, POST /auth/refresh, POST /auth/logout | ✅ |
| **Courts** | CRUD + soft delete + GET /courts/:id | ✅ |
| **OpeningHours** | CRUD + PUT /opening-hours/bulk (replace por cancha) | ✅ |
| **ScheduleExceptions** | CRUD con filtros de fecha y courtId | ✅ |
| **Blocks** | POST / DELETE (sin PATCH) con validación endsAt > startsAt | ✅ |
| **PricingRules** | CRUD + método `resolve()` que calcula precio por prioridad | ✅ |
| **Bookings** | CRUD + confirm / cancel / complete / no-show + POST /hold (público) | ✅ |
| **Customers** | CRUD paginado con búsqueda por nombre/teléfono | ✅ |
| **Settings** | GET + PATCH (single row id=1), mpAccessToken enmascarado | ✅ |
| **Payments** | POST /bookings/:id/payments, DELETE /payments/:id | ✅ |
| **CashRegister** | GET /cash-register?date=YYYY-MM-DD con totales por método | ✅ |

**Detalles técnicos clave:**
- Anti double-booking: constraint `EXCLUDE USING gist` en PostgreSQL; capturado como `P2010 / 23P01` → 409 ConflictException
- `Customer.phone` tiene `@unique` para habilitar `upsert` por teléfono
- `POST /bookings/hold` usa `@SkipAuth()` (endpoint público para reserva web)
- `dayBoundsUtc()` en PaymentsService convierte fecha local del tenant a UTC para filtrar caja diaria correctamente (requiere que el contenedor corra en UTC, que es el default en Alpine)
- Roles: `OWNER`, `MANAGER`, `RECEPTIONIST` — guards activos pero sólo `DELETE /payments/:id` tiene `@Roles(OWNER, MANAGER)` explícito hasta ahora

### Frontend ✅ Completo

| Página/componente | Ruta | Estado |
|---|---|---|
| Login | `/login` | ✅ |
| Canchas (CRUD completo) | `/courts` | ✅ |
| Clientes (listado paginado + búsqueda) | `/customers` | ✅ |
| Configuración del tenant | `/settings` | ✅ |
| Agenda (FullCalendar resource-timegrid) | `/agenda` | ✅ |
| Reservas (stub) | `/bookings` | ⬜ stub |
| Precios (stub) | `/pricing` | ⬜ stub |
| Caja diaria | `/caja` | ✅ |

**Detalles técnicos clave:**
- `FullCalendarView` es un componente `'use client'` importado dinámicamente con `ssr: false`
- `BookingDetail` hace `useQuery(['booking', id])` al abrir para tener pagos frescos, no confía en los datos del calendario
- `BookingForm` hace upsert del cliente por teléfono vía el backend
- Color primario en Settings se aplica en tiempo real via `document.documentElement.style.setProperty('--color-primary', ...)`
- FullCalendar 6.1.20 con `schedulerLicenseKey="CC-Attribution-NonCommercial-NoDerivatives"` (licencia CC para uso no-comercial)

---

## Fase 1 — Continuación (Reserva Web Pública) ✅ Completa

| Página/componente | Ruta | Estado |
|---|---|---|
| Home público | `/` (public) | ✅ |
| Reserva web pública | `/reservar` (public) | ✅ |

**Detalles:**
- Ruta `/reservar` es pública (sin login requerido)
- Selector de fecha con validación (no fechas pasadas)
- Grilla visual: canchas × horarios disponibles
- Calcula slots según `defaultSlotMinutes` + abre holes en HELD/CONFIRMED
- Form inline: nombre + teléfono + email (opcional)
- POST `/bookings/hold` → confirmación visual
- Middleware actualizado para no redirigir `/reservar` a login

## Fase 1 — Continuación (Hold expiry + Bookings + Pricing) ✅ Completa

| Componente | Detalle | Estado |
|---|---|---|
| Hold cleanup service | `apps/api/src/jobs/hold-cleanup.service.ts` | ✅ |
| `/bookings` página | Listado con filtros de estado, cancha, fecha + búsqueda + detalle | ✅ |
| `/pricing` página | CRUD completo de reglas de precio con dialog | ✅ |

**Detalles técnicos:**
- `HoldCleanupService` implementa `OnModuleInit` / `OnModuleDestroy`, corre `setInterval` cada 60s
- En startup busca todos los `HELD` con `heldUntil < now` y los pasa a `CANCELLED`
- No requiere BullMQ ni paquetes adicionales
- `/bookings`: filtros client-side por estado (multi-valor separado por coma), cancha, rango de fechas + búsqueda por texto. Click en fila abre `BookingDetail`
- `/pricing`: tabla + dialog create/edit con todos los campos de `PricingRule`. `formToDto` convierte strings vacíos a `undefined` para campos opcionales

## Fase 1 — Horarios, Excepciones y Bloqueos ✅ Completa

| Componente | Detalle | Estado |
|---|---|---|
| `CourtScheduleDialog` | Dialog con 3 tabs por cancha | ✅ |
| Tab Horarios | Grid semanal con checkbox + time inputs, guarda con PUT /opening-hours/bulk | ✅ |
| Tab Excepciones | Lista + form de alta/baja de excepciones (feriados, días especiales) | ✅ |
| Tab Bloqueos | Lista + form de alta/baja de bloqueos puntuales (datetime-local) | ✅ |
| Botón en Canchas | Ícono `CalendarDays` en cada fila abre el dialog | ✅ |

**Detalles técnicos:**
- `HorariosTab` usa `useEffect` para inicializar el `WeekState` desde los datos del servidor
- Los días deshabilitados no se envían al bulk replace (se borran de la DB)
- Al guardar horarios también invalida `['opening-hours-public']` para que la página `/reservar` refleje los cambios
- Bloques usan `datetime-local` input → convertido a ISO con `new Date(...).toISOString()`

---

## ✅ FASE 1 COMPLETADA

Todos los módulos del MVP operativo están implementados. El sistema es funcional de punta a punta:
- Staff puede gestionar canchas, horarios, precios, clientes y reservas
- Clientes pueden reservar online desde `/reservar`
- Holds expiran automáticamente cada 60s
- Caja diaria registra y muestra cobros por método

---

## Pendiente — Fase 2 (comercial)

### Reserva web pública

- [ ] Página pública `/reservar` (o similar) para el cliente final
- [ ] Selector de fecha → grilla de disponibilidad → form → POST /bookings/hold
- [ ] Pantalla de confirmación "pre-reserva recibida"

---

## Pendiente — Fase 2 (comercial)

- [ ] **Mercado Pago** — Checkout Pro, webhook `/webhooks/mercadopago`, `mpAccessToken` por tenant (ya hay campo en DB, cifrado pendiente)
- [ ] **WhatsApp Cloud API** — confirmaciones y recordatorios (interface preparada, sin implementar)
- [ ] **Dashboard** — KPIs: ocupación %, ingresos del día/semana, top canchas, top clientes
- [ ] **Exportación caja** — CSV de pagos del día
- [ ] **Script provision.sh** — alta de tenant nuevo en VPS
- [ ] **Caddy + deploy VPS** — infra de producción

---

## Decisiones de arquitectura tomadas

| Decisión | Detalle |
|---|---|
| Puerto API en host | `4001` (interno `3001`). Puerto `4000` para web. Evita conflictos con otros proyectos |
| `prisma migrate dev` no funciona en Docker sin TTY | Se usó `migrate deploy` + SQL manual para la migración del unique index en `customers.phone` |
| `Customer.phone` único | Necesario para `upsert` en flujo de reserva. Migración manual: `20260512200000_add_customer_phone_unique` |
| FullCalendar como dynamic import | `ssr: false` — el paquete no es compatible con SSR de Next.js |
| Zona horaria en caja diaria | `dayBoundsUtc()` en el backend usa `toLocaleString` para calcular los límites UTC del día en la zona del tenant |
| Pagos en transacción | `addPayment` / `removePayment` recalculan `paidAmount` y `paymentStatus` en la misma transacción Prisma |

---

## Estructura de archivos clave

```
reservo/
├── prisma/
│   ├── schema.prisma                    ← modelo completo
│   └── migrations/
│       ├── 20260512133606_init/         ← esquema base + EXCLUDE constraint
│       └── 20260512200000_add_customer_phone_unique/
│
├── apps/api/src/
│   ├── app.module.ts                    ← registro de todos los módulos
│   ├── modules/
│   │   ├── auth/                        ← JWT + refresh tokens en Redis
│   │   ├── bookings/                    ← lógica central, anti-solapamiento
│   │   ├── courts/                      ← canchas + horarios de apertura
│   │   ├── customers/                   ← clientes, upsert por teléfono
│   │   ├── payments/                    ← cobros + caja diaria
│   │   ├── pricing/                     ← reglas con prioridad + resolve()
│   │   ├── schedule/                    ← excepciones + bloqueos
│   │   └── settings/                    ← configuración del tenant (row id=1)
│   └── common/
│       ├── decorators/roles.decorator.ts
│       ├── decorators/skip-auth.decorator.ts
│       └── guards/roles.guard.ts
│
└── apps/web/src/
    ├── app/
    │   ├── (admin)/
    │   │   ├── agenda/page.tsx          ← FullCalendar + modals
    │   │   ├── caja/page.tsx            ← caja diaria
    │   │   ├── courts/page.tsx          ← CRUD canchas
    │   │   ├── customers/page.tsx       ← listado clientes
    │   │   ├── settings/page.tsx        ← configuración tenant
    │   │   ├── bookings/page.tsx        ← stub
    │   │   └── pricing/page.tsx         ← stub
    │   └── login/page.tsx
    ├── components/
    │   ├── agenda/
    │   │   ├── booking-detail.tsx       ← detail + pagos inline
    │   │   ├── booking-form.tsx         ← nueva reserva
    │   │   └── fullcalendar-view.tsx    ← resource-timegrid (client only)
    │   ├── layout/
    │   │   ├── sidebar.tsx
    │   │   └── topbar.tsx
    │   └── ui/                          ← Button, Badge, Dialog, Input, etc.
    └── lib/
        ├── api.ts                       ← apiFetch con detección server/client
        ├── auth.ts                      ← NextAuth v5 config
        └── utils.ts                     ← cn, formatDate, formatCurrency
```

---

## Próxima sesión — por dónde seguir

**Opción A (completar MVP operativo):**
1. Implementar expiración de holds (BullMQ worker + cron de barrido)
2. Construir `/bookings` con filtros y paginación
3. Construir UI de horarios y bloqueos en `/courts`

**Opción B (reserva web pública):**
1. Página pública `/reservar` para el cliente final
2. Integración completa con el endpoint `POST /hold`

**Opción C (dashboard):**
1. Página `/dashboard` con KPIs básicos
2. Queries de ocupación y recaudación

El orden recomendado para llegar al primer cliente real: **A → B → C**.
