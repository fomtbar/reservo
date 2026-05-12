# Reservo — Plataforma de Reservas de Canchas

## Context

Proyecto **greenfield** (directorio `C:\proyectosDev\reservo` vacío). El objetivo es construir una web app moderna y minimalista para gestionar reservas de canchas (paddle, fútbol, tenis, hockey…), pensada como **producto comercial reutilizable**: el mismo código base se despliega múltiples veces, una instancia por cliente, en una VPS con Docker.

**Decisiones ya alineadas con el usuario:**
- Multi-tenant: **deploy aislado por cliente** (1 contenedor + 1 DB por negocio).
- Mercado inicial: **Argentina** → Mercado Pago, WhatsApp Cloud API / Twilio, locale `es-AR`, moneda ARS, zona horaria `America/Argentina/Buenos_Aires`.
- MVP: **core operativo** (recepción + reserva web sin pagos online ni WhatsApp).
- Branding: **ligero** — logo, nombre, color primario, dominio propio por instancia.

El plan describe arquitectura, stack, modelo de datos, módulos, roadmap por fases, riesgos y buenas prácticas.

---

## 1. Stack tecnológico recomendado

| Capa | Elección | Por qué |
|---|---|---|
| **Backend** | **NestJS 11 (Node 22, TypeScript)** | Modular, DI sólida, batteries-included (validación, guards, interceptors, OpenAPI auto), excelente para APIs concurrentes. Comparte tipos con el front. |
| **ORM** | **Prisma** | Migraciones declarativas, types autogenerados, mejor DX del ecosistema. |
| **DB** | **PostgreSQL 16** | Constraints fuertes (EXCLUDE, partial unique) imprescindibles para evitar doble reserva. JSON nativo para configuración por negocio. |
| **Cache / locks / colas** | **Redis 7 + BullMQ** | Holds de pre-reservas con TTL automático, rate limiting, jobs background (recordatorios, liberación de holds, expiración de señas). |
| **Frontend** | **Next.js 15 (App Router) + React 19** | SSR para páginas públicas (SEO), Server Actions para mutaciones, mismo TypeScript que el back. |
| **UI kit** | **Tailwind v4 + shadcn/ui + Radix primitives** | Estilo moderno, accesible, totalmente customizable (no es "componentes negros"). |
| **Estado servidor** | **TanStack Query v5** | Cache, optimistic updates, polling para la agenda en vivo. |
| **Forms / validación** | **react-hook-form + zod** | Schema compartido cliente/servidor (DRY). |
| **Calendario** | **FullCalendar** (resourceTimeGridDay/Week) | El estándar de facto para vistas de recurso × tiempo; muy customizable. Alternativa: build propio con shadcn si se quiere look 100% minimalista. |
| **Auth** | **Auth.js (NextAuth v5) + JWT del back** | Credentials para staff, sin OAuth en MVP. Refresh tokens en Redis. |
| **Logs** | **Pino + pino-pretty** (dev) → JSON estructurado a stdout (prod, captado por Loki o Docker logs). |
| **Tests** | **Vitest** (unit) + **Playwright** (e2e) + Supertest (back). |
| **Infra** | **Docker Compose** por instancia + **Caddy** (reverse proxy host) con SSL automático Let's Encrypt. |

**Alternativas evaluadas (descartadas para este caso):**
- *FastAPI*: igual de válido, pero perderíamos types compartidos con Next.js y BullMQ.
- *Django*: admin gratis es tentador, pero el frontend custom no usaría su admin y la agenda visual no encaja con templates Django.
- *Drizzle ORM*: más liviano que Prisma pero ecosistema/migraciones menos pulidos hoy.
- *Nginx*: válido, pero **Caddy** simplifica SSL a cero configuración — relevante para sumar clientes rápido.

---

## 2. Arquitectura multi-tenant (deploy-per-tenant)

```
VPS (Ubuntu 22.04)
├── Caddy (host)              :80 :443  →  TLS + routing por dominio
│   ├── club-paddle-1.com     →  reservo-cliente1 (compose)
│   ├── canchas-futbol-x.com  →  reservo-cliente2 (compose)
│   └── …
│
├── Stack por cliente (Docker Compose)
│   ├── api          (NestJS)
│   ├── web          (Next.js, SSR)
│   ├── postgres     (volumen propio)
│   ├── redis        (volumen propio)
│   └── worker       (BullMQ jobs)
│
└── /opt/reservo/
    ├── core/                  ← repo único (monorepo, git tag por release)
    ├── tenants/<slug>/        ← .env + docker-compose.override.yml + branding/
    └── backups/<slug>/        ← dumps pg + retención 30d
```

**Aislamiento total:** cada cliente tiene su propio Postgres, Redis y volúmenes. Una vulnerabilidad de datos en un cliente no toca a los otros. Backups independientes.

**Reutilización:** un solo repo (`core`). Para crear cliente nuevo:
```
./scripts/provision.sh club-paddle-1 club-paddle-1.com
```
Esto genera `tenants/club-paddle-1/` con `.env` (DB password, branding, JWT secret, MP keys cuando aplique), levanta el compose, registra el dominio en Caddy, ejecuta migraciones y crea el usuario admin inicial.

**Updates globales:** `git pull` en `core/` → `./scripts/upgrade.sh <slug>` corre migraciones y rebuild de imágenes para ese cliente. Releases versionadas (semver) en git tags; cada cliente puede quedarse en una versión específica si necesita.

---

## 3. Estructura del proyecto (monorepo)

```
reservo/
├── apps/
│   ├── api/                  NestJS
│   │   └── src/
│   │       ├── modules/
│   │       │   ├── auth/
│   │       │   ├── users/
│   │       │   ├── courts/
│   │       │   ├── bookings/
│   │       │   ├── pricing/
│   │       │   ├── schedule/         (apertura, feriados, bloqueos)
│   │       │   ├── payments/         (interface + stub MP)
│   │       │   ├── notifications/    (interface + stub WhatsApp)
│   │       │   ├── settings/         (config tenant)
│   │       │   └── audit/
│   │       ├── common/
│   │       └── jobs/                 (BullMQ workers)
│   │
│   └── web/                  Next.js
│       └── src/
│           ├── app/
│           │   ├── (public)/         reserva online del cliente final
│           │   ├── (admin)/          panel de recepción
│           │   └── api/              proxies / auth
│           ├── components/ui/        shadcn
│           ├── components/calendar/
│           ├── lib/
│           └── hooks/
│
├── packages/
│   ├── shared/               tipos + zod schemas compartidos
│   ├── config-tenant/        loader de configuración por negocio
│   └── ui/                   (opcional v2) librería de componentes común
│
├── infra/
│   ├── caddy/Caddyfile.tmpl
│   ├── compose/docker-compose.yml
│   ├── compose/docker-compose.override.tmpl.yml
│   └── scripts/
│       ├── provision.sh
│       ├── upgrade.sh
│       ├── backup.sh
│       └── restore.sh
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
└── docs/
```

Monorepo simple (npm workspaces o pnpm). Sin Turborepo en MVP para no agregar peso.

---

## 4. Modelo de datos inicial

```prisma
// Identidad y permisos
User { id, email, name, phone, passwordHash, role, active, createdAt }
  role: enum OWNER | MANAGER | RECEPTIONIST | CUSTOMER

// Catálogo
Court {
  id, name, sport, color, active, sortOrder,
  defaultSlotMinutes,  // ej 60 o 90
  bufferMinutes,       // tiempo entre turnos
  metadata Json        // techada, iluminación, etc.
}

// Calendario operativo
OpeningHour {              // semanal recurrente
  id, courtId?, dayOfWeek (0-6), opensAt, closesAt
  // courtId NULL = aplica a todas las canchas
}

ScheduleException {        // feriados, días especiales, mantenimiento
  id, courtId?, date, opensAt?, closesAt?, closedAllDay, reason
}

Block {                    // bloqueo manual por staff
  id, courtId, startsAt, endsAt, reason, createdById
}

// Reservas
Booking {
  id,
  courtId,
  startsAt timestamptz,
  endsAt   timestamptz,
  status   enum: HELD | CONFIRMED | CANCELLED | COMPLETED | NO_SHOW
  source   enum: WALK_IN | PHONE | WEB
  customerId,           // FK Customer
  createdById,          // staff que la cargó (null si la creó el cliente web)
  price        decimal,
  priceOverride boolean,
  deposit      decimal default 0,
  paidAmount   decimal default 0,
  paymentStatus enum: UNPAID | PARTIAL | PAID | REFUNDED
  notes text,
  heldUntil    timestamptz?    // solo HELD; TTL
  cancelReason text?,
  createdAt, updatedAt

  // Constraint clave:
  // EXCLUDE USING gist (
  //   courtId WITH =, tstzrange(startsAt, endsAt, '[)') WITH &&
  // ) WHERE (status IN ('HELD','CONFIRMED'))
}

Customer {
  id, name, phone, email?, notes?, totalBookings, lastBookingAt, createdAt
  // Sin login obligatorio: en MVP el cliente web solo da nombre+tel
}

// Precios
PricingRule {
  id, courtId?,            // null = global
  dayOfWeek?,
  startTime time?, endTime time?,
  validFrom date?, validUntil date?,
  amount decimal,
  priority int,            // mayor priority gana
  label text               // "Fin de semana noche"
}

// Pagos (stub MVP)
Payment {
  id, bookingId, amount, method enum (CASH | CARD | TRANSFER | MERCADOPAGO),
  externalId text?, status, raw Json, createdAt
}

// Auditoría
AuditLog {
  id, userId, action, entity, entityId, before Json?, after Json?, ip, createdAt
}

// Settings del tenant (1 fila)
TenantSettings {
  id (PK fija = 1),
  businessName, logoUrl, primaryColor,
  timezone (default 'America/Argentina/Buenos_Aires'),
  currency (default 'ARS'),
  holdMinutes int (default 15),
  allowWebBooking bool,
  requireDepositForWeb bool,
  cancellationPolicyHours int,
  whatsappEnabled bool,
  mpAccessToken text? (encrypted)
}
```

**Reglas duras (constraints en DB, no solo app):**
- `EXCLUDE` GIST sobre solapamiento de `Booking` activos por cancha → imposible reserva duplicada incluso bajo concurrencia.
- `Block` aplica el mismo EXCLUDE.
- `CHECK (endsAt > startsAt)`, `CHECK (paidAmount <= price)`.
- Índices: `Booking(startsAt, courtId)`, `Booking(customerId)`.

---

## 5. Módulos del sistema (MVP)

1. **Auth & Roles** — login email/password, JWT 15min + refresh 7d (Redis blocklist). Roles: OWNER, MANAGER, RECEPTIONIST, CUSTOMER (web sin password).
2. **Settings del tenant** — pantalla única para owner: nombre, logo, color, horario default, hold minutes, política de cancelación.
3. **Canchas** — CRUD canchas con sport, color, slot default, buffer.
4. **Horarios y excepciones** — apertura semanal por cancha (o global), feriados, bloqueos puntuales, mantenimiento.
5. **Pricing** — reglas con prioridad: día/hora/cancha/rango fechas. Cálculo determinista del precio al crear booking.
6. **Agenda** — vista día/semana, resource view por cancha, drag-and-drop para reprogramar (con confirmación), filtros, colores por estado.
7. **Reservas internas** — alta rápida (cliente nuevo o existente vía typeahead por nombre/tel), cobro parcial/total, override de precio (audit log), cancelación con motivo, marcar no-show, completar al terminar.
8. **Reserva web pública** — selector de fecha → grilla de canchas/horarios libres → form mínimo (nombre + tel + email opcional) → HELD por N minutos → confirmación pendiente de validación por staff (en MVP, sin pago online).
9. **Lista de holds expirados** — job cada 60s libera HELD vencidos. Notifica al staff los pendientes de confirmar.
10. **Clientes** — listado con historial, búsqueda, total de reservas, última visita, notas.
11. **Caja diaria** — suma de pagos del día por método, exportable a CSV. Cierre de turno: marcar punto y comparar con efectivo contado.
12. **Auditoría** — qué staff hizo qué cambio (override de precio, cancelación, bloqueo).
13. **Dashboard** — KPIs simples: ocupación %, ingresos del día/semana, top canchas, top clientes.

**Fuera del MVP (interfaces preparadas, implementación luego):**
- Pagos online (Mercado Pago Checkout Pro / Preference + webhooks).
- WhatsApp (recordatorios T-24h, T-2h; confirmación de reserva).
- Lista de espera.
- QR de validación de reserva.
- App móvil.

---

## 6. Flujo completo de reservas

**Reserva interna (recepcionista):**
1. Abre agenda → click en slot libre → modal "Nueva reserva".
2. Typeahead cliente: si existe lo selecciona, si no lo crea inline (nombre + tel obligatorio).
3. Sistema calcula precio según `PricingRule`. Recepcionista puede override (audit).
4. Marca cobro: nada / seña / total / método (cash/card/transfer). Crea `Payment`.
5. Status → CONFIRMED. Transacción atómica con check de overlap.
6. Si quiere reservar sobre `Block`: solo MANAGER/OWNER puede forzar; se registra en audit.

**Reserva web (cliente final):**
1. Página pública `/` → selector de fecha (default hoy).
2. Render server-side: grilla canchas × horarios con disponibilidad real (excluyendo HELD activos).
3. Cliente toca un slot → form (nombre, tel, email opcional, acepta términos).
4. POST `/api/bookings/hold` → transacción:
   - Verifica disponibilidad con `SELECT ... FOR UPDATE` o usando el EXCLUDE constraint atrapando 23P01.
   - Crea Booking con `status=HELD`, `heldUntil=now()+15min`.
   - Agenda job BullMQ "release-hold" con delay = 15min (si sigue HELD, lo cancela).
5. Cliente ve pantalla "Pre-reserva confirmada — el local te contactará en X minutos para confirmar" + WhatsApp prefilled link al negocio.
6. Notificación al staff en agenda (badge / sonido configurable) → recepcionista marca CONFIRMED (cancela job de release).

**Fase 2 con pago online:** misma secuencia, pero antes de release-hold se redirige a Mercado Pago. Webhook `payment.approved` confirma. Si no llega en 15min, hold expira automático.

---

## 7. Permisos y roles

| Acción | OWNER | MANAGER | RECEPTIONIST | CUSTOMER |
|---|---|---|---|---|
| Ver agenda | ✓ | ✓ | ✓ | — |
| Crear / editar reserva | ✓ | ✓ | ✓ | propia (HELD) |
| Cancelar reserva | ✓ | ✓ | ✓ | propia (HELD) |
| Override de precio | ✓ | ✓ | (configurable) | — |
| Crear sobre Block | ✓ | ✓ | — | — |
| Editar canchas / horarios | ✓ | ✓ | — | — |
| Editar pricing | ✓ | ✓ | — | — |
| Cierre de caja | ✓ | ✓ | ✓ (su turno) | — |
| Settings del tenant | ✓ | — | — | — |
| Gestionar usuarios | ✓ | — | — | — |
| Auditoría | ✓ | ✓ (read) | — | — |

Implementado con guards de NestJS + claims en JWT. Permisos finos via `@RequirePermission('booking.override-price')` para no atar todo al rol.

---

## 8. Estrategia de pagos (preparada para fase 2)

Interface `PaymentProvider` en `apps/api/src/modules/payments/`:
```ts
interface PaymentProvider {
  createCheckout(booking, amount, returnUrl): Promise<{ url, externalId }>
  handleWebhook(payload, signature): Promise<PaymentEvent>
  refund(externalId, amount): Promise<RefundResult>
}
```
Implementaciones: `ManualProvider` (MVP — registra cash/transfer), `MercadoPagoProvider` (fase 2 — Checkout Pro con Preference API + webhook firmado).

**Decisiones clave para MP:**
- Cada tenant pone su propio access token en `TenantSettings.mpAccessToken` (cifrado AES-256-GCM con `MASTER_KEY` del `.env`).
- Webhook endpoint dedicado `/webhooks/mercadopago` con verificación de firma `x-signature`.
- Idempotencia: tabla `PaymentEvent` con unique en `externalId` para resistir reentregas.
- Modo sandbox vs producción según env.

**Otros métodos previstos:** transferencia (validación manual), efectivo, tarjeta presencial (POS externo — solo registro), Modo (futuro).

---

## 9. Estrategia de notificaciones (fase 2)

Interface `NotificationProvider` con drivers:
- `WhatsAppCloudAPIProvider` (Meta, gratis hasta cierto volumen, requiere número verificado).
- `TwilioWhatsAppProvider` (fallback).
- `EmailProvider` (Resend o SMTP).

Jobs BullMQ:
- `booking.confirmed` → mensaje inmediato con detalle.
- `reminder.t-24h` y `reminder.t-2h` → cron por booking.
- `hold.expiring` → al staff cuando un hold queda 2min de vencer.

Plantillas en DB por tenant para que cada negocio personalice tono.

---

## 10. Infraestructura y deploy en VPS

**Stack del servidor (1 VPS ≥ 2 vCPU / 4 GB RAM puede soportar 5-10 tenants chicos):**
- Ubuntu 22.04 LTS, Docker + Compose v2, ufw, fail2ban.
- **Caddy** como reverse proxy host (instalado en el host, no en Docker, para gestionar TLS de todos los tenants).
- Volúmenes Docker para Postgres/Redis por tenant.

**`docker-compose.yml` por tenant (resumen):**
```yaml
services:
  api:      build: ./apps/api      env_file: .env  depends_on: [db, redis]
  web:      build: ./apps/web      env_file: .env  depends_on: [api]
  worker:   build: ./apps/api      command: node dist/jobs/main.js
  db:       image: postgres:16-alpine  volumes: [pgdata:/var/lib/postgresql/data]
  redis:    image: redis:7-alpine      volumes: [redisdata:/data]
```

**Backups:**
- `backup.sh` corre por cron diario 03:00: `pg_dump` por tenant → `/opt/reservo/backups/<slug>/YYYY-MM-DD.sql.gz`.
- Retención 30 días local + sync a S3/Backblaze B2 (opcional).
- Script `restore.sh` para rollback puntual.

**Logs:**
- `docker compose logs` rotation por defecto.
- (Opcional v2) Loki + Grafana en una VPS aparte o servicio gestionado para todos los tenants.

**Monitoreo:**
- Healthchecks `/health` en api y web (Caddy puede hacer health-based routing).
- (Opcional) Uptime Kuma autohosted para alertar caídas a Telegram/email.

**Seguridad:**
- Secrets en `.env` con permisos `600`, propietario root.
- Cifrado en reposo de tokens MP (clave maestra en `.env`).
- Headers de seguridad (HSTS, CSP) en Caddy.
- Rate limiting de auth y endpoints públicos (Redis + middleware).
- CSRF tokens en mutaciones del panel admin.
- Sin `eval`, sin upload de archivos ejecutables, validación zod estricta.

---

## 11. Roadmap por fases

**Fase 0 — Bootstrap (1 semana)**
- Monorepo, Docker base, Prisma schema base, auth, settings tenant, deploy de 1 instancia de prueba.

**Fase 1 — MVP operativo (3–4 semanas)**
- Canchas, horarios, bloqueos, pricing, agenda visual, reserva interna completa, clientes, caja diaria, auditoría, dashboard básico.
- Reserva web con hold de 15min + confirmación manual.
- Branding ligero (logo, color, dominio).
- Script `provision.sh` listo para sumar clientes.
- **Hito: vender al primer cliente.**

**Fase 2 — Comercial (3–4 semanas)**
- Mercado Pago real (señas online).
- WhatsApp Cloud API (confirmación + 2 recordatorios).
- Lista de espera por slot.
- Reportes exportables (CSV/PDF).
- QR para validar reserva en mostrador.

**Fase 3 — Escala (continuo)**
- Estadísticas avanzadas (heatmap ocupación, LTV cliente).
- App móvil (React Native) para clientes recurrentes.
- Promociones automáticas (códigos descuento).
- Programa de fidelidad.
- Multi-sucursal dentro de un mismo tenant.
- Marketplace público (lista de clubes que usan Reservo).

---

## 12. Riesgos técnicos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| **Doble reserva por race condition** | EXCLUDE constraint GIST en DB + transacción serializable + retry. Nunca confiar solo en el check de aplicación. |
| **Holds que nunca expiran** | TTL en columna `heldUntil` + job BullMQ delayed + cron de barrido cada 5min como red de seguridad. |
| **Reloj/zona horaria** | Todo en UTC en DB, `timestamptz`. Conversión solo en presentación con `date-fns-tz` + `TenantSettings.timezone`. Tests con DST. |
| **Override de precio o cancelación abusiva** | Audit log obligatorio + permiso fino + dashboard de "acciones sensibles" para el owner. |
| **Acumulación de tenants en una VPS** | Definir límite (ej: 8 tenants / 4GB RAM). Métricas de uso por compose. Migrar a otra VPS con `restore.sh` y cambio de DNS. |
| **Upgrades que rompen un tenant** | Tags semver, `upgrade.sh` ejecuta dry-run de migraciones, rollback por restore de dump previo. |
| **Mercado Pago webhook perdido** | Idempotencia + reconciliación nocturna que consulta API por preferences "pending". |
| **Spam de pre-reservas web** | Rate limit por IP + tel, captcha invisible (hCaptcha) si pasa umbral, bloqueo de teléfonos con N no-shows. |
| **Pérdida de datos** | Backups diarios cifrados + restore probado mensualmente. |

---

## 13. Mejoras de producto sugeridas

- **Vista "día de hoy" para recepción** en una sola pantalla (próxima hora destacada + lista de check-in).
- **Sonido + badge** cuando entra reserva web pendiente.
- **Modo TV** (read-only pantalla grande para mostrar el día).
- **Vínculo de pago compartible** por WhatsApp (deep link MP) para cobrar señas sin que el cliente entre a la web.
- **Cliente recurrente sugerido** — al tipear nombre, sugerir cliente por similitud (pg_trgm).
- **Reglas de "ventana de reserva"** — el cliente web solo puede reservar con 1h–14 días de anticipación (configurable).
- **Override soft de buffer** — cuando hay buffer de 15min, permitir igual reservar si quien lo hace es staff (caso real: socios habituales).
- **Comprobante PDF** por reserva (para el cliente que pide).

---

## 14. Buenas prácticas para producción

- **CI/CD**: GitHub Actions → build + test + push de imágenes a GHCR. Despliegue via SSH + `upgrade.sh`.
- **Versionado**: semver en tags. Cada tenant fija una versión en su `.env` (`APP_VERSION=1.4.2`).
- **Migraciones**: solo additive en cada release. Drop de columnas en release N+2 tras dejar de usarlas.
- **Feature flags por tenant** en `TenantSettings` (campos bool: `allowWebBooking`, `whatsappEnabled`, etc.).
- **Errores**: Sentry self-hosted o cloud (free tier alcanza para empezar) por proyecto-tenant.
- **Testing**: e2e crítico cubre flujo reserva interna + reserva web + colisión concurrente.
- **Documentación**: `docs/RUNBOOK.md` con procedimientos de incidentes; `docs/ONBOARDING.md` para sumar dev nuevo; `docs/TENANT_PROVISION.md`.
- **Convenciones**: ESLint + Prettier + commitlint (Conventional Commits), Husky pre-commit con typecheck rápido.

---

## 15. Archivos críticos que se crearán en la implementación

- `prisma/schema.prisma` — modelo completo.
- `apps/api/src/modules/bookings/bookings.service.ts` — núcleo de lógica con transacciones.
- `apps/api/src/modules/bookings/hold.processor.ts` — job BullMQ.
- `apps/api/src/modules/pricing/pricing.service.ts` — resolución determinista.
- `apps/web/src/app/(admin)/agenda/page.tsx` — calendario.
- `apps/web/src/app/(public)/reservar/page.tsx` — flow del cliente.
- `infra/scripts/provision.sh` — alta de tenant nuevo.
- `infra/compose/docker-compose.yml` y `infra/caddy/Caddyfile.tmpl` — base de deploy.

---

## 16. Verificación / aceptación del MVP

Para considerar el MVP terminado se debe poder, en un deploy real:

1. **Provisionar un cliente nuevo** con `./scripts/provision.sh test-cliente test.local` y tenerlo accesible en `https://test.local` con TLS válido en < 5 min.
2. **Crear desde el panel** una cancha, su horario de apertura, una regla de precio y un feriado.
3. **Reservar internamente** un horario, registrar seña parcial y verla en la caja diaria.
4. **Reservar desde la web pública** y verla aparecer como HELD en el panel; dejarla expirar 15min y comprobar liberación automática.
5. **Confirmar otra reserva web** desde el panel y verla pasar a CONFIRMED.
6. **Probar colisión concurrente**: dos peticiones simultáneas al mismo slot → solo una crea, la otra recibe error 409.
7. **Hacer dump y restore** de la DB del tenant con los scripts y comprobar integridad.
8. **Pasar `pnpm test` (unit + e2e Playwright)** en verde.

---

## 17. Puntos abiertos a decidir antes de cualquier implementación

Quedan voluntariamente fuera del plan hasta que los discutamos:

- **Política de cancelación final** (horas mínimas, devolución total/parcial/no devolución).
- **Mecanismo de "no-show"**: penalización automática (bloqueo del cliente N días) o solo registro estadístico.
- **Confirmación de reservas web sin pago**: ¿se confirman automáticamente al cabo de X min si no las rechaza el staff, o quedan pendientes hasta acción humana?
- **Nombre comercial del producto** y URL pública del marketplace futuro.
- **Identidad gráfica** (paleta global, tipografía base) antes de armar el design system.
- **Definición de "primer cliente piloto"**: qué deporte, cuántas canchas, qué expectativas — para ajustar prioridades de Fase 1.

---

## 18. Estado del documento

Este archivo es **únicamente planificación**. No habilita aún la implementación. Próximo paso esperado: tu revisión de cada sección y feedback puntual sobre lo que querés ajustar, profundizar o descartar antes de movernos al modo de ejecución.
