# 02 — Arquitectura y despliegue

## Vista general

```
Navegador (móvil primero)
   │  HTML SSR / RSC + server actions
   ▼
Next.js (App Router, Node standalone)  ──  Hostinger Business
   │  @supabase/ssr (cookie de sesión del usuario → RLS aplica)
   ▼
Supabase: Postgres + RLS · Auth · Storage · pg_cron
```

- **Una sola aplicación Next.js.** Las mutaciones van por server actions y las consultas por Server Components. Los route handlers (`app/api`) solo se usan donde hace falta HTTP (por ejemplo, `/api/health`).
- **La seguridad vive en la base de datos.** Las consultas usan el cliente de Supabase con la sesión del usuario, así RLS se aplica siempre. La `service_role` solo se usa en servidor y para tareas internas puntuales, documentadas en `05-decisiones.md`.
- **Las reglas críticas viven en Postgres:** la anti-superposición (restricción de exclusión), el alta de reservas (función transaccional) y los vencimientos (`pg_cron`). Next.js no tiene timers ni procesos en segundo plano.
- **El cálculo de precios** es una función TypeScript sin efectos secundarios que solo corre en el servidor. El resultado se guarda congelado en la reserva.

## Estructura del repositorio

```
src/
  app/
    (public)/[slug]/        página pública del establecimiento
    (auth)/                 login, registro, recuperar contraseña
    panel/                  panel del propietario (roles owner/admin/operator)
    admin/                  panel del Superadmin
    api/health/             chequeo de despliegue
    sitemap.ts  robots.ts
  modules/<dominio>/        lógica por dominio: schemas.ts (Zod), queries.ts,
                            actions.ts (server actions), *.ts puros + *.test.ts
                            dominios: organizaciones, suscripciones, establecimientos,
                            unidades, reservas, tarifas, pagos, huespedes, publico
  components/ui/            shadcn
  lib/supabase/             clientes server/browser/middleware, tipos generados
supabase/
  migrations/               SQL versionado (única forma de cambiar el esquema)
  seed.sql                  datos ficticios
tests/
  db/                       Vitest contra el proyecto Supabase de desarrollo (RLS, concurrencia)
  e2e/                      Playwright (flujos móviles críticos)
docs/
```

## Entornos

| Entorno | App | Base de datos |
|---|---|---|
| Local | `next dev` | Proyecto Supabase **dev** (nube, gratis) |
| Prueba | Hostinger: `darkcyan-seahorse-806320.hostingersite.com` | Proyecto Supabase dev |
| Producción | Hostinger + dominio definitivo | Proyecto Supabase **prod** (plan Pro: backups y sin pausa) |

No hay Docker, así que no se usa `supabase start`. El flujo es:
`supabase link --project-ref <dev>` → `supabase migration new <nombre>` → editar el SQL → `supabase db push` → `supabase gen types typescript --linked > src/lib/supabase/database.types.ts`.

## Variables de entorno (`.env.example`, sin valores)

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`): públicas.
- `SUPABASE_SECRET_KEY` (`sb_secret_…`): **solo servidor**, nunca con el prefijo `NEXT_PUBLIC_`. Reemplaza a la `service_role` heredada.
- `NEXT_PUBLIC_SITE_URL`: para canonical, sitemap y Open Graph.
- `PORT` (lo define Hostinger) y `BIND_HOST` (opcional, por defecto `0.0.0.0`).
- Pruebas de base de datos: claves del proyecto dev (nunca de producción).

## Despliegue en Hostinger (se valida en la Fase 0)

1. En `next.config`, `output: 'standalone'` e imágenes servidas ya optimizadas desde Supabase Storage, sin optimización en el servidor.
2. Conectar el repositorio de GitHub al sitio Node.js desde hPanel. Ahí se verifican la versión de Node (≥ 22; en desarrollo se usa 24) y el puerto. Comandos: install `npm ci`, build `npm run build`, start `npm start`. `npm start` ejecuta `scripts/start-standalone.mjs`, que copia `public/` y `.next/static/` dentro del standalone y escucha en `0.0.0.0:$PORT`. Fijar la IP de escucha es necesario porque muchos hosts definen `HOSTNAME` con el nombre de la máquina, y el `server.js` de Next la usaría para escuchar.
3. Cargar las variables de entorno en hPanel y comprobar cuáles están disponibles en build y cuáles en runtime.
4. Verificar que `/` y `/api/health` respondan, y que `/api/health` consulte Supabase sin exponer claves.
5. Registrar los límites observados (memoria y tiempo de build). Si el build no entra en el plan compartido, la alternativa es compilar en GitHub Actions y desplegar el artefacto, o pasar a VPS.
6. Las migraciones **nunca** se ejecutan al arrancar la app: van con `supabase db push` como paso explícito.
7. Para volver atrás, se redespliega el commit anterior desde hPanel. Las migraciones se escriben hacia adelante, y si una es destructiva lleva su script de reversión.

## Tareas programadas (pg_cron en Supabase)

| Tarea | Frecuencia | Qué hace |
|---|---|---|
| `expire_provisional_bookings()` | cada 5 min | `provisional` con `expires_at < now()` → `expired` |
| `run_subscription_lifecycle()` | diaria, 03:00 ART | trial/active vencidas → `past_due`; vencidas tras los días de gracia → `suspended` |

Las dos son idempotentes. Además, la función de alta de reservas vence las provisionales caducadas de la unidad antes de insertar, así el resultado no depende de cuándo corrió la tarea.

## SEO y páginas públicas

Las páginas públicas van en `/{slug}`, dentro del dominio de la plataforma. Se generan con SSR o ISR, con `generateMetadata` (title, description, canonical, Open Graph) y JSON-LD `LodgingBusiness`. Se usa `revalidateTag` cuando el propietario guarda cambios. La disponibilidad se consulta en el momento con una función RPC de solo lectura. `robots.ts` bloquea `/panel`, `/admin` y `/api`. Una organización suspendida responde "no disponible" con `noindex`.
