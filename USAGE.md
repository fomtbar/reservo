# Reservo — Guía de uso completa

## Índice

1. [Entorno de desarrollo](#1-entorno-de-desarrollo)
2. [Comandos del día a día](#2-comandos-del-día-a-día)
3. [Credenciales y variables de entorno](#3-credenciales-y-variables-de-entorno)
4. [Panel de administración](#4-panel-de-administración)
5. [Portal público](#5-portal-público)
6. [Configuración inicial del negocio](#6-configuración-inicial-del-negocio)
7. [Flujo completo de una reserva](#7-flujo-completo-de-una-reserva)
8. [Integraciones](#8-integraciones)
9. [API — referencia rápida](#9-api--referencia-rápida)
10. [Solución de problemas frecuentes](#10-solución-de-problemas-frecuentes)

---

## 1. Entorno de desarrollo

### Requisito único

**Docker Desktop** instalado y corriendo. No se necesita Node, pnpm ni nada más en la PC.

### Levantar todo

```bash
# Desde la raíz del proyecto
docker compose -f docker-compose.dev.yml up
```

Esto levanta 4 servicios:

| Servicio | URL en el host | Descripción |
|---|---|---|
| Web (Next.js) | `http://localhost:4000` | Panel admin + portal público |
| API (NestJS) | `http://localhost:4001/api` | REST API |
| PostgreSQL | `localhost:5433` | Base de datos |
| Redis | `localhost:6380` | Cache + colas BullMQ |

> La app móvil Expo se levanta aparte: `docker compose -f docker-compose.dev.yml --profile mobile up`

### Primera vez (base de datos nueva)

Las migraciones corren automáticamente al levantar el contenedor. Si necesitás correrlas manualmente:

```bash
docker compose -f docker-compose.dev.yml exec api pnpm prisma migrate dev
```

Crear el primer usuario admin:

```bash
docker compose -f docker-compose.dev.yml exec api pnpm ts-node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
prisma.user.create({
  data: {
    email: 'admin@reservo.com',
    name: 'Admin',
    passwordHash: bcrypt.hashSync('admin123', 10),
    role: 'OWNER',
  }
}).then(u => console.log('Creado:', u.email)).finally(() => prisma.\$disconnect());
"
```

O usar el seed si existe:

```bash
docker compose -f docker-compose.dev.yml exec api pnpm prisma db seed
```

---

## 2. Comandos del día a día

```bash
# Levantar entorno
docker compose -f docker-compose.dev.yml up

# Levantar en background
docker compose -f docker-compose.dev.yml up -d

# Ver logs en tiempo real
docker compose -f docker-compose.dev.yml logs -f

# Ver logs de un servicio puntual
docker compose -f docker-compose.dev.yml logs -f api
docker compose -f docker-compose.dev.yml logs -f web

# Detener todo
docker compose -f docker-compose.dev.yml down

# Reiniciar un servicio (ej. después de agregar un módulo nuevo a la API)
docker compose -f docker-compose.dev.yml restart api

# Abrir shell en un contenedor
docker compose -f docker-compose.dev.yml exec api sh
docker compose -f docker-compose.dev.yml exec web sh

# Correr migración de Prisma
docker compose -f docker-compose.dev.yml exec api pnpm prisma migrate dev --name descripcion

# Generar cliente Prisma
docker compose -f docker-compose.dev.yml exec api pnpm prisma generate

# Abrir Prisma Studio (inspector visual de la DB)
# → http://localhost:5556
docker compose -f docker-compose.dev.yml exec api pnpm prisma studio --port 5556

# Instalar una dependencia en la API
docker compose -f docker-compose.dev.yml exec api pnpm add nombre-paquete

# Instalar una dependencia en el Web
docker compose -f docker-compose.dev.yml exec web pnpm add nombre-paquete

# Limpiar cache de Next.js (cuando los cambios no se reflejan)
docker compose -f docker-compose.dev.yml exec web rm -rf /app/.next
docker compose -f docker-compose.dev.yml restart web

# Correr tests
docker compose -f docker-compose.dev.yml exec api pnpm test
```

---

## 3. Credenciales y variables de entorno

### Variables en `.env.dev` (desarrollo)

| Variable | Valor dev | Para qué sirve |
|---|---|---|
| `DATABASE_URL` | `postgresql://reservo:reservo_dev@reservo-db-dev:5432/reservo_dev` | Conexión Prisma |
| `REDIS_URL` | `redis://reservo-redis-dev:6379` | Cache y BullMQ |
| `JWT_SECRET` | `dev-jwt-secret-...` | Firmar tokens de sesión |
| `MASTER_KEY` | `dev-master-key-32-chars-exactly!!` | Cifrar tokens de Mercado Pago |
| `AUTH_SECRET` | `dev-nextauth-secret-...` | NextAuth |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4001/api` | API desde el browser |
| `API_URL` | `http://reservo-api-dev:3001/api` | API server-side (Docker) |
| `NEXT_PUBLIC_MP_SANDBOX` | `true` | Usar sandbox de MP en dev |

### Variables opcionales (activar integraciones)

```bash
# WhatsApp Cloud API (Meta)
WHATSAPP_ACCESS_TOKEN=EAAx...
WHATSAPP_PHONE_NUMBER_ID=123456789

# Mercado Pago (se configura por panel, no por env)
# El access token se guarda cifrado en TenantSettings via /settings

# ngrok para webhooks de MP en dev
APP_API_URL=https://tu-url.ngrok.io
MP_WEBHOOK_URL=https://tu-url.ngrok.io
```

---

## 4. Panel de administración

**URL:** `http://localhost:4000` → login → panel

### Login

- URL: `http://localhost:4000/login`
- Email y contraseña del usuario OWNER/MANAGER/RECEPTIONIST creado en la DB

### Secciones del panel

#### Dashboard `/dashboard`

KPIs del negocio en tiempo real:
- Ocupación del día (%) por cancha
- Ingresos del día y la semana
- Reservas por estado (confirmadas, pendientes, canceladas)
- Top canchas por uso
- Top clientes por frecuencia

#### Agenda `/agenda`

Vista principal de operación diaria:
- **Grilla FullCalendar** con una columna por cancha
- **Navegar por día** con flechas y botón "Hoy"
- **Filtro de sucursal** (dropdown arriba a la derecha si hay sucursales)
- **Click en slot libre** → abre form de nueva reserva
- **Click en reserva existente** → abre detalle con opciones

**Form de nueva reserva:**
1. Buscá el cliente por teléfono (typeahead) — si no existe, completá nombre + tel para crearlo inline
2. El precio se calcula automáticamente según las reglas de pricing
3. Podés hacer override del precio (queda registrado en audit log)
4. Registrá el cobro: monto, método (efectivo / tarjeta / transferencia)
5. Si el cliente tiene tier de fidelidad activo (Silver/Gold), aparece el descuento disponible
6. Guardá → la reserva queda CONFIRMED

**Detalle de reserva existente:**
- Ver estado, cliente, cancha, horario, pagos
- Cambiar estado: Confirmar / Completar / No-show / Cancelar
- Agregar pagos adicionales
- Ver QR de validación para mostrar en mostrador
- Editar notas

#### Reservas `/bookings`

Tabla de todas las reservas con filtros:
- Por estado (Confirmada, Pendiente, Completada, Cancelada, No-show)
- Por fecha (desde / hasta)
- Por cancha

#### Lista de espera `/waitlist`

Clientes anotados en slots que estaban ocupados al momento de intentar reservar. Cuando se libera un slot (cancelación), el sistema notifica automáticamente al primero de la lista.

#### Caja `/caja`

Resumen de pagos del día:
- Total por método (efectivo, tarjeta, transferencia, MP)
- Cierre de turno: marcar el momento de cierre

#### Reportes `/reports`

- **Revenue report**: ingresos por período con breakdown por día y método de pago → Export CSV / Imprimir PDF
- **Bookings report**: listado detallado de reservas → Export CSV

#### Estadísticas `/stats`

- **Heatmap de ocupación**: mapa de calor por hora × día de la semana — muestra cuándo están más ocupadas las canchas históricamente
- **LTV de clientes**: tabla rankeada por valor de vida del cliente (total gastado, promedio por reserva, frecuencia, última visita)

#### Sucursales `/branches`

Gestión de sedes físicas (si el negocio tiene más de una ubicación):
- Crear sucursal: nombre (obligatorio), dirección, teléfono, orden
- Ver cuántas canchas tiene cada sede
- Activar / desactivar sucursal

#### Canchas `/courts`

Gestión del catálogo de canchas:
- **Crear cancha**: nombre, deporte (Pádel/Tenis/Fútbol 5/etc.), color, slot por defecto (30/45/60/90/120 min), buffer entre turnos, orden, sucursal (opcional)
- **Horarios de apertura**: click en el ícono de calendario → definir qué días y en qué horario está disponible la cancha
  - Podés definir horarios por día de la semana
  - Podés crear excepciones (feriados, cierre especial, mantenimiento)
  - Podés crear bloqueos manuales para rangos horarios puntuales
- **Activar / desactivar** cancha sin perder su historial

#### Clientes `/customers`

Base de clientes del negocio:
- Buscar por nombre o teléfono
- Ver historial de reservas, total de reservas, última visita
- Ver tier de fidelidad (badge Silver/Gold si el programa está activo)
- Editar notas del cliente

#### Precios `/pricing`

Reglas de precio con prioridad (la de mayor prioridad gana):
- **Por día de la semana** (ej. "fin de semana")
- **Por rango horario** (ej. "pico noche 20-23hs")
- **Por cancha específica**
- **Por rango de fechas** (ej. "verano enero")
- Combinaciones de todos los anteriores

El sistema calcula el precio automáticamente al crear una reserva usando la regla de mayor prioridad que aplique.

#### Promociones `/promos`

Códigos de descuento para clientes:
- **Tipo Fijo ($)**: descuenta un monto fijo del total
- **Tipo Porcentaje (%)**: descuenta un porcentaje del total
- **Configuración**: fecha de vigencia (desde/hasta), máximo de usos, monto mínimo de reserva
- Los códigos se validan en tiempo real cuando el cliente los ingresa en el portal público

#### Configuración `/settings`

##### General
- Nombre del negocio (aparece en el portal público y el header)
- URL del logo
- Color primario (preview en tiempo real)
- Zona horaria
- Moneda

##### Reservas
- **Minutos de hold**: cuánto tiempo tiene el cliente para pagar antes de que se libere la pre-reserva (default: 15 min)
- **Horas mínimas para cancelar**: política de cancelación
- **Reserva web pública**: activar/desactivar el portal de reserva online
- **Requerir seña**: si está activo, el cliente debe pagar via Mercado Pago para confirmar la reserva web

##### Integraciones
- **WhatsApp**: activar/desactivar notificaciones automáticas
- **Access token Mercado Pago**: pegá tu `APP_USR-...` token para habilitar cobros online

##### Programa de fidelidad
- Activar/desactivar el programa
- **Silver**: mínimo N reservas para acceder al tier → descuento X%
- **Gold**: mínimo M reservas → descuento Y%
- El descuento se aplica automáticamente en el booking-form cuando se selecciona un cliente con tier activo

---

## 5. Portal público

**URL:** `http://localhost:4000` (sin login)

### Homepage `/`

Vitrina del club visible para cualquier visitante:
- Nombre y logo del negocio
- Deportes disponibles (pills)
- Sedes con dirección, teléfono y link a su página
- Todas las canchas organizadas por sede
- Botón "Reservar ahora"

### Página de sucursal `/sucursal/[id]`

- Info detallada de la sede
- Canchas disponibles en esa sede
- Botón "Reservar en esta sede" → lleva al reservar pre-filtrado por esa sede

### Reservar `/reservar`

Flujo de reserva para el cliente final:

1. **Elegir fecha** con el date picker (mínimo: hoy)
2. **Ver disponibilidad** en la grilla de canchas × horarios
   - Slots verdes = disponibles
   - Slots grises = ocupados
   - Si hay lista de espera disponible, aparece opción "Anotarme"
3. **Click en un slot libre** → abre el formulario de reserva
4. **Completar**: nombre, teléfono (obligatorios), email (opcional), código de descuento (opcional, con validación en tiempo real)
5. **Confirmar** → la reserva queda en estado HELD por 15 min (configurable)
   - Si el negocio requiere seña: redirige a Mercado Pago
   - Si no: muestra confirmación "Pre-reserva recibida"
6. El staff confirma desde el panel → el cliente recibe WhatsApp (si está configurado)

### Filtro por sucursal en reserva

`/reservar?branch=[id]` — llega desde el botón "Reservar en esta sede":
- Muestra banner con el nombre de la sede
- Filtra la grilla para mostrar solo las canchas de esa sede
- Botón "Ver todas" para quitar el filtro

### Validación de reserva `/reserva/[id]`

Página pública para validar una reserva en el mostrador:
- Muestra estado, cancha, horario y nombre del cliente
- Accesible por QR (el staff genera el QR desde el detalle de la reserva en el panel)

---

## 6. Configuración inicial del negocio

Pasos recomendados al poner en marcha una instancia nueva:

### 1. Configurar datos del negocio

Panel → **Configuración** (`/settings`):
- Nombre del negocio
- Zona horaria correcta (importante para que los horarios sean correctos)
- Moneda
- Color primario

### 2. Crear sucursales (si aplica)

Panel → **Sucursales** (`/branches`):
- Crear una entrada por cada sede física
- Completar dirección y teléfono (aparecen en el portal público)

### 3. Crear canchas

Panel → **Canchas** (`/courts`):
- Una cancha por recurso físico
- Asignarle deporte, color identificador, slot por defecto
- Asignarle la sucursal correspondiente (si aplica)
- Definir sus horarios de apertura (ícono de calendario)

### 4. Definir reglas de precio

Panel → **Precios** (`/pricing`):
- Al menos una regla base (global, sin restricciones de día/horario)
- Agregar reglas de pico/valle según los horarios del negocio
- Mayor número de prioridad = esa regla gana ante las demás

### 5. Crear usuarios de staff

Vía API o seed → crear usuarios con rol MANAGER o RECEPTIONIST para el personal del negocio.

### 6. Activar portal web

Panel → **Configuración** → Reservas → activar "Reserva web pública".

---

## 7. Flujo completo de una reserva

### Reserva interna (recepcionista)

```
Agenda → click slot libre
  → buscar cliente (tel/nombre) o crear nuevo
  → sistema calcula precio según reglas
  → ajustar cobro si es necesario (override con audit log)
  → Crear → reserva CONFIRMED
```

### Reserva web (cliente)

```
/reservar → elegir fecha → click slot
  → completar nombre + tel → (opcional: código de descuento)
  → Confirmar → estado: HELD (15 min)
    → [con seña] redirige a Mercado Pago → pago → webhook → CONFIRMED
    → [sin seña] staff confirma manualmente desde la agenda → CONFIRMED
  → WhatsApp de confirmación al cliente (si configurado)
  → Recordatorio T-24h y T-2h (si configurado)
```

### Expiración de hold

Si el cliente no completa la reserva web en 15 min, BullMQ libera el slot automáticamente (estado → CANCELLED). El slot vuelve a estar disponible en la grilla.

### Lista de espera

```
Cliente intenta reservar slot ocupado → click "Anotarme"
  → completa datos → queda en lista
  → al cancelarse la reserva original → sistema notifica por WhatsApp al primero de la lista
```

---

## 8. Integraciones

### Mercado Pago

1. Obtenés el **access token de producción** en `https://www.mercadopago.com.ar/developers`
2. Panel → **Configuración** → pegás el token en "Access token Mercado Pago"
3. Activás "Requerir seña en web" si querés cobro obligatorio al reservar online
4. Para el webhook en producción, MP debe poder llamar a `https://tu-dominio.com/api/webhooks/mercadopago`

**En desarrollo (sandbox):**
- `NEXT_PUBLIC_MP_SANDBOX=true` en `.env.dev` usa los checkouts de prueba
- Usá ngrok para que MP pueda llamar al webhook local:
  ```bash
  ngrok http 4001
  # Luego en .env.dev:
  APP_API_URL=https://xxxxx.ngrok.io
  MP_WEBHOOK_URL=https://xxxxx.ngrok.io
  ```

### WhatsApp Cloud API (Meta)

1. Crear una app en `https://developers.facebook.com`
2. Agregar producto WhatsApp Business
3. Obtener **Access Token** y **Phone Number ID**
4. En `.env.dev` (o `.env` en prod):
   ```
   WHATSAPP_ACCESS_TOKEN=EAAx...
   WHATSAPP_PHONE_NUMBER_ID=123456789
   ```
5. Panel → **Configuración** → activar "WhatsApp habilitado"

Los mensajes se envían automáticamente en:
- Confirmación de reserva
- Recordatorio 24h antes
- Recordatorio 2h antes

---

## 9. API — referencia rápida

Base URL en dev: `http://localhost:4001/api`

Los endpoints protegidos requieren header:
```
Authorization: Bearer <jwt_token>
```

### Auth

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/auth/login` | Login → devuelve `accessToken` + `refreshToken` |
| `POST` | `/auth/refresh` | Renovar token con `refreshToken` |
| `POST` | `/auth/logout` | Invalidar refresh token |

### Canchas (públicas)

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/courts` | Listar canchas activas |
| `GET` | `/courts?includeInactive=true` | Listar todas |
| `GET` | `/courts?branchId=xxx` | Filtrar por sucursal |
| `GET` | `/courts/:id` | Detalle de cancha |
| `POST` | `/courts` | Crear (OWNER/MANAGER) |
| `PATCH` | `/courts/:id` | Editar |
| `DELETE` | `/courts/:id` | Desactivar |

### Horarios

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/opening-hours` | Horarios de apertura |
| `POST` | `/opening-hours` | Crear horario |
| `PATCH` | `/opening-hours/:id` | Editar |
| `DELETE` | `/opening-hours/:id` | Eliminar |
| `PUT` | `/opening-hours/bulk-replace` | Reemplazar todos los horarios de una cancha |

### Reservas

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/bookings` | Listar (`?from=&to=&status=&courtId=`) |
| `GET` | `/bookings/availability?date=YYYY-MM-DD` | Disponibilidad del día (pública) |
| `POST` | `/bookings/hold` | Crear pre-reserva web (pública) |
| `POST` | `/bookings` | Crear reserva interna |
| `PATCH` | `/bookings/:id` | Editar |
| `POST` | `/bookings/:id/confirm` | Confirmar HELD → CONFIRMED |
| `POST` | `/bookings/:id/cancel` | Cancelar |
| `POST` | `/bookings/:id/complete` | Marcar completada |
| `POST` | `/bookings/:id/no-show` | Marcar no-show |
| `GET` | `/bookings/:id/public` | Datos públicos (sin auth, para QR) |
| `POST` | `/bookings/:id/mp-checkout` | Generar link MP |

### Clientes

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/customers` | Listar (`?search=&page=&limit=`) |
| `GET` | `/customers/:id` | Detalle + historial |
| `POST` | `/customers` | Crear |
| `PATCH` | `/customers/:id` | Editar |

### Pagos

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/bookings/:bookingId/payments` | Registrar pago |
| `DELETE` | `/payments/:id` | Eliminar pago |

### Sucursales (públicas)

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/branches` | Listar activas (pública) |
| `GET` | `/branches?includeInactive=true` | Todas |
| `GET` | `/branches/:id` | Detalle (pública) |
| `POST` | `/branches` | Crear (OWNER/MANAGER) |
| `PATCH` | `/branches/:id` | Editar |
| `DELETE` | `/branches/:id` | Desactivar |

### Promociones

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/promo-codes` | Listar (OWNER/MANAGER) |
| `POST` | `/promo-codes` | Crear |
| `PATCH` | `/promo-codes/:id` | Editar |
| `DELETE` | `/promo-codes/:id` | Eliminar |
| `GET` | `/promo-codes/validate?code=&amount=&courtId=` | Validar código (pública) |

### Pricing

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/pricing` | Listar reglas |
| `POST` | `/pricing` | Crear regla |
| `PATCH` | `/pricing/:id` | Editar |
| `DELETE` | `/pricing/:id` | Eliminar |

### Dashboard y estadísticas

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/dashboard` | KPIs del día |
| `GET` | `/stats/occupancy?from=&to=` | Heatmap de ocupación |
| `GET` | `/stats/customers/ltv` | LTV de clientes |
| `GET` | `/cash-register?date=` | Caja del día |

### Configuración

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/settings/public` | Config pública (nombre, logo, booking activo) |
| `GET` | `/settings` | Config completa (protegida) |
| `PATCH` | `/settings` | Actualizar (OWNER) |
| `GET` | `/loyalty/config` | Config programa de fidelidad |
| `PATCH` | `/loyalty/config` | Actualizar |

### Webhooks

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/webhooks/mercadopago` | Webhook de pagos MP (verificación de firma) |

---

## 10. Solución de problemas frecuentes

### Los cambios en el código no se reflejan en el browser

**Causa:** cache de Next.js no se invalidó en Docker.

```bash
docker compose -f docker-compose.dev.yml exec web rm -rf /app/.next
docker compose -f docker-compose.dev.yml restart web
# Luego Ctrl+Shift+R en el browser
```

### La API no levanta / error de módulo no encontrado

**Causa:** se agregó un módulo nuevo pero el contenedor no lo detectó.

```bash
docker compose -f docker-compose.dev.yml restart api
```

### Error de TypeScript en la API en dev

El typechecker corre en background. Los errores aparecen en los logs pero **no detienen el servidor** en modo dev. Para ver errores:

```bash
docker compose -f docker-compose.dev.yml logs api | grep TSC
```

### "No QueryClient set" en páginas públicas

El layout público tiene su propio `QueryClientProvider`. Si aparece este error en una página pública nueva, envolvé el componente en su propio `QueryClientProvider` a nivel de página.

### La reserva web no redirige a Mercado Pago

Verificar:
1. `NEXT_PUBLIC_MP_SANDBOX=true` está seteado
2. El access token de MP está configurado en `/settings`
3. "Requerir seña en web" está activado en `/settings`
4. El webhook URL es accesible desde internet (usar ngrok en dev)

### El slot no se libera después de 15 min

El worker de BullMQ corre dentro del contenedor `reservo-api-dev`. Verificar que esté activo:

```bash
docker compose -f docker-compose.dev.yml logs api | grep -i "hold\|worker\|bull"
```

### Prisma: error "P2023" o schema desincronizado

```bash
# Regenerar cliente Prisma
docker compose -f docker-compose.dev.yml exec api pnpm prisma generate

# Si la DB está adelante del schema local:
docker compose -f docker-compose.dev.yml exec api pnpm prisma migrate deploy
```

### Puerto ocupado al levantar Docker

Los puertos de Reservo son no estándar para evitar conflictos:
- `4000` → web
- `4001` → api
- `5433` → postgres
- `6380` → redis

Si alguno está ocupado, buscá el proceso que lo usa o editá el puerto en `docker-compose.dev.yml`.

---

## Estructura de archivos clave

```
reservo/
├── apps/
│   ├── api/src/modules/         # Módulos NestJS
│   │   ├── auth/                # JWT + roles
│   │   ├── bookings/            # Reservas + hold + MP checkout
│   │   ├── branches/            # Sucursales
│   │   ├── courts/              # Canchas + horarios
│   │   ├── customers/           # Clientes + fidelidad
│   │   ├── dashboard/           # KPIs
│   │   ├── loyalty/             # Programa de fidelidad
│   │   ├── notifications/       # WhatsApp
│   │   ├── payments/            # Pagos + MP webhook
│   │   ├── pricing/             # Reglas de precio
│   │   ├── promos/              # Códigos de descuento
│   │   ├── schedule/            # Excepciones y bloqueos
│   │   ├── settings/            # Configuración del tenant
│   │   ├── stats/               # Estadísticas avanzadas
│   │   ├── users/               # Gestión de staff
│   │   └── waitlist/            # Lista de espera
│   │
│   ├── web/src/app/
│   │   ├── (admin)/             # Panel de administración
│   │   │   ├── agenda/          # Calendario FullCalendar
│   │   │   ├── bookings/        # Tabla de reservas
│   │   │   ├── branches/        # Sucursales CRUD
│   │   │   ├── caja/            # Caja diaria
│   │   │   ├── courts/          # Canchas CRUD
│   │   │   ├── customers/       # Clientes
│   │   │   ├── dashboard/       # KPIs
│   │   │   ├── pricing/         # Reglas de precio
│   │   │   ├── promos/          # Códigos de descuento
│   │   │   ├── reports/         # Reportes exportables
│   │   │   ├── settings/        # Configuración
│   │   │   ├── stats/           # Estadísticas
│   │   │   └── waitlist/        # Lista de espera
│   │   │
│   │   └── (public)/            # Portal público
│   │       ├── page.tsx         # Homepage / vitrina del club
│   │       ├── reservar/        # Flujo de reserva online
│   │       ├── reserva/[id]/    # Validación de reserva por QR
│   │       └── sucursal/[id]/   # Página por sede
│   │
│   └── mobile/                  # App Expo (React Native)
│
├── prisma/
│   ├── schema.prisma            # Modelos de datos
│   └── migrations/              # Historial de migraciones SQL
│
├── docker-compose.dev.yml       # Entorno de desarrollo
├── .env.dev                     # Variables de entorno dev
└── USAGE.md                     # Este archivo
```
