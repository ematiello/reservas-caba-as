# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estado del proyecto

Plataforma **SaaS multiempresa de reservas** para cabañas, casas, departamentos, habitaciones y pequeños hoteles: Superadmin → Propietarios (organizaciones) → Establecimientos → Unidades. Fuente funcional: `Plan CHATGPT.docx` (relevamiento). Para leerlo: `unzip -p "Plan CHATGPT.docx" word/document.xml | sed -e 's/<\/w:p>/\n/g' -e 's/<[^>]*>//g'`. Análisis, decisiones y diseño aprobados en `docs/` (empezar por `docs/05-decisiones.md`).

Fase 0 cerrada y verificada (esqueleto, `supabase link` al proyecto dev `uqgmtcmdaxruiwkawxxx`, despliegue de prueba en Hostinger).

Fase 1 (organizaciones y acceso) cerrada: 3 ramas apiladas con push (`feat/fase-1-a-db` → `-b-auth` → `-c-admin-team`), revisadas; Superadmin del usuario creado en dev. Ver `odd/tasks/fase-1-organizaciones-acceso.md`.

Fase 2 (suscripciones) implementada y revisada en 2 ramas apiladas (`feat/fase-2-a-db` → `feat/fase-2-b-ui`; ver `odd/tasks/fase-2-suscripciones.md`). Planes, días de prueba y de gracia se editan en `/admin/planes` (D22); `org_is_active()` evalúa la suscripción y la fecha (D23).

Fase 3 (alojamientos) implementada y revisada en 2 ramas apiladas sobre la Fase 2 (`feat/fase-3-a-db` → `feat/fase-3-b-ui`; ver `odd/tasks/fase-3-alojamientos.md`). Fase 4 (motor de reservas y calendario) implementada en 2 ramas apiladas (`feat/fase-4-a-db` → `feat/fase-4-b-ui`; ver `odd/tasks/fase-4-reservas.md`): reservas y bloqueos en `bookings` con exclusión gist, reglas en el trigger `bookings_guard`, calendario en `/panel/reservas`. Fase 5 (tarifas y pagos de huéspedes) implementada y revisada en 2 ramas apiladas (`feat/fase-5-a-db` → `feat/fase-5-b-ui`; ver `odd/tasks/fase-5-tarifas-pagos.md`): motor puro `src/modules/tarifas/pricing.ts`; el precio congelado y la seña se escriben solo con el cliente `service_role` de `src/lib/supabase/admin.ts` (servidor), que exige `SUPABASE_SECRET_KEY` en runtime (`scripts/start-standalone.mjs` carga los `.env*`; en Hostinger va como variable de entorno). Fase 6 (página pública, buscador y diseño) en 4 ramas apiladas (`feat/fase-6-a-db` → `-b-ui` → `-c-buscador` → `feat/fase-6-d-diseno-panel`; ver `odd/tasks/fase-6-pagina-publica.md` y `odd/tasks/fase-6-d-diseno-panel.md`): identidad "Reservas Traslasierra" en toda la app (tokens de marca en `:root` de `globals.css`, Montserrat y Lato en el layout raíz, cabecera con pestañas en `src/components/shell/`). Siguiente: **Fase 7 — producción**. En Hostinger, `SITE_INDEXING=on` y `NEXT_PUBLIC_SITE_URL` se definen **al compilar** (la portada es estática). Fotos en el bucket `media` con ruta `{org_id}/{property_id}/...`, redimensionadas en el navegador. En e2e, la ruta anterior queda montada y oculta (`cacheComponents`): usar `.filter({ visible: true })` cuando un campo se repite entre páginas. Correr la suite muchas veces seguidas choca con el límite de inicios de sesión de Supabase Auth.

## Comandos

```bash
npm run dev                 # desarrollo (Turbopack); borra antes .next/dev (su caché persistente llegó a servir CSS viejo)
npm run lint                # ESLint
npm run typecheck           # next typegen && tsc (LayoutProps/PageProps son tipos generados)
npm test                    # Vitest (src/**/*.test.ts, tests/db/**/*.test.ts). Las pruebas de BD y los e2e con datos necesitan las 3 claves del proyecto dev en .env.local (incluida SUPABASE_SECRET_KEY) y FALLAN si faltan; SKIP_DB_TESTS=1 las saltea a propósito
npx vitest run src/lib/supabase/env.test.ts   # un archivo
npx vitest run -t "fails fast"                 # un test por nombre
npm run test:e2e            # Playwright: build + server standalone en :3100, móvil y escritorio. Falla si :3100 está ocupado (puede ser un build viejo); E2E_REUSE_SERVER=1 reutiliza un server recién levantado del build actual
npm run build               # build de producción (output: standalone)
npm start                   # scripts/start-standalone.mjs: copia estáticos y arranca .next/standalone/server.js
npm run package:hostinger   # tras `npm run build`: arma dist/hostinger/app.tgz para subir a Hostinger (D20)
npx supabase migration new <nombre>   # nueva migración (nunca inventar el nombre del archivo)
npx supabase db push        # aplica migraciones al proyecto linkeado (dev)
npm run db:types            # regenera src/lib/supabase/database.types.ts
```

**Next.js 16.4** (ver `AGENTS.md`): leer la guía en `node_modules/next/dist/docs/` antes de usar una API. `middleware` ahora es `src/proxy.ts`; APIs de request asíncronas (`await cookies()`); `cacheComponents` activado.

Supabase: claves **publishable/secret** (no `anon`/`service_role`). Clientes en `src/lib/supabase/` — `server.ts` (con sesión del usuario, RLS aplica), `client.ts` (navegador), `proxy.ts` (refresca la sesión solo en `/panel`, `/admin`, `/auth`; no autoriza). Autorizar siempre en la página/acción y en RLS, nunca solo en el proxy.

Trabajar fase por fase y **detenerse para revisión al final de cada una**. Una fase termina cuando cumple su criterio de aceptación (`docs/04-plan-y-pruebas.md`), no cuando compila.

## Alcance: MVP núcleo

Incluido: Superadmin, planes y suscripciones con **cobro manual**, propietarios con colaboradores, establecimientos/categorías/unidades, motor de reservas y calendario, tarifas, pagos manuales de huéspedes (seña/saldo), página pública con SEO básico y WhatsApp (enlace).

**Fuera del MVP (v1.1)** — no implementar sin aprobación: CRM/segmentación/promociones/remarketing, Google AdSense, gastos y reportes económicos, centro de notificaciones, API de WhatsApp, pasarelas de pago online, dominios propios por establecimiento, traducciones. (El buscador general entró al MVP: D26.)

## Stack y entorno

Next.js App Router + TypeScript (`output: 'standalone'`), Tailwind CSS, shadcn/ui, React Hook Form + Zod, Supabase (Postgres, Auth SSR con cookies, Storage, RLS, `pg_cron`), Vitest y Playwright. Una sola app Next.js; **no** agregar Express, Docker, Redis, colas ni microservicios sin aprobación. Español sin i18n. Mobile-first.

- Hosting: **Hostinger Business** (Node.js). Sitio de prueba: `violet-quail-122403.hostingersite.com`. Gestión vía MCP `hostinger-api`; nada sobre producción sin autorización.
- Base de datos de desarrollo: **proyecto Supabase en la nube** separado de producción (no hay Docker, no usar `supabase start`). Migraciones versionadas en `supabase/migrations/`, aplicadas con `supabase db push`. Tipos con `supabase gen types` (no escribir tipos de tablas a mano). Pruebas de BD/RLS con Vitest contra el proyecto de desarrollo.
- Gestor de paquetes: **npm** (no hay pnpm). Fijar versiones y commitear el lockfile.
- UI: colores, tipografías y radios salen de los tokens de `globals.css` (nunca un hex en una clase de un componente ni una variable que se apunte a sí misma; los dibujos de `src/components/brand` son la excepción); `<select>` y `<textarea>` nativos usan `selectClass`/`textareaClass` de `src/components/ui/native-controls.ts` (lo vigila `src/app/ui-guards.test.ts`). Las pestañas de la cabecera son solo navegación (`shellNavigation`); cada página autoriza.
- Lógica de negocio en `src/modules/<dominio>/`, separada de los componentes; esquemas Zod compartidos entre formularios y server actions.

## Invariantes que no se negocian

- **Aislamiento por organización:** toda tabla de negocio lleva `org_id`; RLS habilitada en todas las tablas expuestas, con el patrón único `org_id in (select user_org_ids())` (función `STABLE SECURITY DEFINER`). Superadmin vía `is_platform_admin()` en las políticas; la `service_role` solo en servidor y solo para tareas internas. Operaciones del Superadmin quedan auditadas.
- **Roles fijos:** `owner`, `admin`, `operator` (operador: calendario y reservas; sin tarifas, pagos sensibles ni configuración). No crear matriz de permisos configurable.
- **Cuenta suspendida:** `org_is_active()` en las políticas → panel de solo lectura y página pública "no disponible".
- **Anti-superposición en la base de datos:** reservas y bloqueos en la misma tabla, `EXCLUDE USING gist (unit_id WITH =, <rango bloqueado> WITH &&)` para estados que bloquean (provisional, confirmada, bloqueo). El intervalo de limpieza extiende el rango bloqueado (columna generada). Ocultar fechas en la UI no alcanza.
- **Inventario de hoteles:** cada habitación es una unidad física; la categoría solo agrupa. Reservar por categoría = función que asigna la primera unidad libre capturando la violación de exclusión. No hay contadores de cupos.
- **Fechas:** estadías como `DATE` local, salida exclusiva (10→13 ocupa noches 10, 11, 12). Timestamps en UTC + zona horaria del establecimiento.
- **Vencimientos sin Node:** provisionales (6–12 h, configurable) con `expires_at`; `pg_cron` las vence periódicamente y la función de alta vence las caducadas de la unidad antes de insertar. Suscripciones: `pg_cron` diario (prueba → activa → vencida → suspendida). Nunca `setTimeout` ni cron de Hostinger para lógica crítica.
- **Tarifas:** función TypeScript sin efectos secundarios que calcula noche por noche con prioridad explícita (base < temporada < fin de semana < feriado < fecha especial, salvo prioridad configurada). Se calcula en el servidor; el cliente nunca envía importes. Precio, desglose y seña se **congelan** en la reserva. Importes en enteros (centavos), moneda explícita (ARS).
- **Circuitos económicos separados:** pagos de suscripciones ≠ pagos de huéspedes (≠ gastos y AdSense en v1.1).
- Una consulta por WhatsApp no crea reservas. Imágenes en Supabase Storage (redimensionadas en el navegador), nunca en el disco de Hostinger. Panel y datos de huéspedes no indexables.

## Skills y herramientas por tarea

Skills en `.claude/skills/` (registrados en `skills-lock.json`; actualizar con `npx skills update -p`):

- **Esquema, migraciones, RLS, índices, motor de reservas** → `supabase-postgres-best-practices` + `supabase`.
- **React / Next.js** → `vercel-react-best-practices`.
- **UI** → `shadcn`, `frontend-design` (dirección visual), `web-design-guidelines` (auditoría UI/accesibilidad).
- **Pruebas** → `vitest` (tarifas, disponibilidad, vencimientos, RLS) y `playwright-best-practices` (e2e, móvil).
- **Inspeccionar la BD de desarrollo** → MCP `supabase` (`.mcp.json`): fijado a `uqgmtcmdaxruiwkawxxx` y en `read_only`. Sirve para leer esquema, logs y advisors y para consultas. Los cambios de esquema van siempre por migraciones con la CLI. Nunca apuntarlo a producción.
- **SEO** → `seo-audit`. **Revisión** → `/code-review`, `/security-review`, agentes `review-*`, `judgment-day`. **Docs** → MCP Context7.
- Hook `gga` (pre-commit) revisa `*.ts,*.tsx,*.js,*.jsx,*.sql` staged usando este archivo como reglas (`.gga`).

## Forma de trabajo

- Tareas chicas inline; subagentes solo para exploración amplia o verificación independiente. Revisión profunda (4R) solo en alto riesgo: migraciones/RLS, motor de reservas, suscripciones/suspensión, autenticación.
- Prueba primero en reglas críticas: superposición y concurrencia, tarifas, vencimientos, aislamiento entre organizaciones.
- No inventar reglas ni parámetros comerciales (precios/límites de planes, días de gracia, dominio, SMTP): proponer opciones y pedir decisión. Registrar decisiones en `docs/05-decisiones.md`.
- No borrar tests ni debilitar tipos para que compile. Sin migraciones destructivas sin aprobación y plan de reversión. Datos ficticios y credenciales de prueba; nunca producción sin autorización. `.env*` fuera de Git (solo `.env.example`).
- Al cerrar cada tarea: resumir archivos modificados, decisiones, pruebas ejecutadas y pendientes.
