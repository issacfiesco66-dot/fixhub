# FixHub — Marketplace de Servicios Locales

MVP estilo Thumbtack/Habitissimo. Diseñado para escalar a cualquier servicio (reparación, plomería, electricidad, jardinería, instalación, etc.), iniciando con reparación de electrodomésticos.

## Stack

- **Next.js 15** (App Router, RSC, Server Actions)
- **PostgreSQL** + **Prisma ORM**
- **Tailwind CSS**
- **Stripe Checkout** (tarjeta + OXXO)
- **SSE** (Server-Sent Events) para alertas en tiempo real — reemplazable por Pusher/Supabase Realtime sin tocar la UI

## Arrancar

```bash
# 1. Instalar
pnpm install        # o npm install

# 2. Configurar entorno
cp .env.example .env
# Edita DATABASE_URL y las llaves de Stripe

# 3. Base de datos
pnpm db:push        # crea las tablas
pnpm db:seed        # carga categorías, servicios, marcas, ciudades y un técnico demo

# 4. Levantar
pnpm dev
```

**Demo:** `tecnico@fixhub.mx` / `demo1234` (saldo $1500 MXN precargado).

## Probar el flujo completo

1. Abre `http://localhost:3000/panel/login` en una pestaña → entra como técnico → estarás en `/panel`.
2. Abre `http://localhost:3000/reparacion-lavadoras-mabe-guadalajara` en otra pestaña.
3. Llena el formulario → envía.
4. **En el panel del técnico verás:** modal flotante con countdown de 60s + ping de audio.
5. Click en "Atender Servicio por $450 MXN" → se debita el saldo + se muestra modal con teléfono/WhatsApp del cliente.
6. Si vacías el saldo, el siguiente click abre el modal de recarga con Stripe Checkout.

## Arquitectura

```
src/
├─ app/
│  ├─ page.tsx                      # Landing principal
│  ├─ [slug]/page.tsx               # SEO: /reparacion-{service}-{brand}-{city}
│  ├─ panel/
│  │  ├─ page.tsx                   # Dashboard (server component)
│  │  ├─ login/page.tsx
│  │  └─ _components/
│  │     ├─ TechnicianDashboard.tsx # Cliente: orquesta realtime y modales
│  │     ├─ LeadAlertModal.tsx      # Modal flotante con countdown 60s
│  │     ├─ ContactRevealModal.tsx  # Datos del cliente tras compra
│  │     ├─ RechargeModal.tsx       # Stripe Checkout
│  │     └─ LeadCard.tsx
│  ├─ api/
│  │  ├─ leads/route.ts             # POST crear lead (publica al broker)
│  │  ├─ leads/[id]/purchase/route.ts # POST compra atómica
│  │  ├─ realtime/route.ts          # SSE stream
│  │  ├─ billing/
│  │  │  ├─ packages/route.ts
│  │  │  ├─ checkout/route.ts       # Crea sesión Stripe
│  │  │  ├─ webhook/route.ts        # Confirma pago e incrementa saldo (idempotente)
│  │  │  └─ me/route.ts             # GET saldo + transacciones
│  │  └─ auth/technician-login/route.ts
│  ├─ sitemap.ts                    # Sitemap programático
│  └─ robots.ts
├─ components/
│  └─ LeadForm.tsx                  # Formulario público
└─ lib/
   ├─ prisma.ts                     # Cliente singleton
   ├─ realtime.ts                   # Broker pub/sub (in-memory; swap a Pusher en prod)
   ├─ auth.ts                       # Cookie firmada con techId (stub MVP)
   ├─ stripe.ts
   ├─ validators.ts                 # Zod schemas
   └─ utils.ts                      # formatMXN, maskPhone, cn
```

## Decisiones clave

### Realtime
- **Broker en memoria** con canales `cityId:serviceId`. Un técnico se suscribe a `coverages × services`.
- Para producción multi-instancia: swap a Pusher/Ably/Supabase Realtime. La API pública del broker (`subscribe`/`publish`) no cambia, solo el cuerpo en `src/lib/realtime.ts`.
- SSE elegido sobre WebSocket porque es 1-way (servidor→técnico) y trivial en Next route handlers.

### Exclusividad del lead
- `LeadPurchase.leadId @unique` — garantiza que solo un técnico puede comprar.
- Si dos hacen click a la vez, Prisma tira P2002 y el segundo recibe `409 LEAD_TAKEN`.
- La transacción completa: verificación de status + verificación de saldo + creación de purchase + decremento de balance + actualización de status + registro contable. Si algo falla, rollback.

### Pricing en MXN entero
- Se guarda como `Int` (sin centavos) — suficiente para MVP. Para fintech real usar `Decimal`.
- Stripe recibe centavos (`amount * 100`).

### SEO programático
- `generateStaticParams()` pre-renderiza `service × city` y `service × brand × city` para todas las combinaciones activas.
- Parsing greedy del slug en `parseSlug()` porque service/brand/city pueden contener guiones.
- `sitemap.ts` se genera del mismo catálogo.

### Recarga Stripe
- Usa **Checkout** (no Elements embebido) por simplicidad y porque soporta OXXO nativo — esencial en MX.
- Webhook `checkout.session.completed` es **idempotente** vía `stripeSessionId @unique`.
- Pre-registra una `BalanceTransaction` PENDING al crear sesión, la marca COMPLETED en el webhook.

## Próximos pasos sugeridos

- [ ] Auth.js completo (OAuth Google + magic links para clientes)
- [ ] Webhooks de OXXO async (la sesión se queda en `payment_status: 'pending'` hasta que paguen)
- [ ] Sistema de calificación cliente→técnico post-servicio
- [ ] Refund automático si el cliente no contestó en 24h
- [ ] Push notifications nativas (Web Push API) para alertas con app en background
- [ ] Mover broker a Pusher cuando haya más de una instancia
- [ ] Dashboard admin (métricas, refunds, verificación de técnicos)
- [ ] Job cron para expirar leads viejos
