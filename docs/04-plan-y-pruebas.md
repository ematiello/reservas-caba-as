# 04 — Plan de desarrollo y pruebas

Cada fase entrega una funcionalidad completa: migración, lógica, UI y pruebas. La fase termina **con el criterio de salida cumplido y revisión del usuario**. Si una prueba falla, no se avanza.

| Fase | Entrega | Criterio de salida | Revisión 4R |
|---|---|---|---|
| **0. Base** | Git + `gga`; Next.js con TS, Tailwind y shadcn; ESLint; Vitest; Playwright; clientes de Supabase; `.env.example`; proyecto Supabase dev; despliegue de prueba en Hostinger | `/` y `/api/health` responden en Hostinger y la ruta de salud consulta Supabase; `lint`, `typecheck`, `test` y `build` pasan; procedimiento de despliegue documentado | — |
| **1. Organizaciones y acceso** | Tablas de plataforma y organización, `user_org_ids()` y demás funciones de control, registro y login (Auth SSR), aprobación por el Superadmin, colaboradores con roles, auditoría | Invariantes 4 y 5 de `03` probados; las rutas `/panel` y `/admin` están protegidas en el servidor | ✓ |
| **2. Suscripciones** | Planes, suscripción, prueba de 7 días, pagos manuales, días de gracia, descuentos, `run_subscription_lifecycle()` con `pg_cron`, suspensión con `org_is_active()` | Transiciones de estado probadas con fechas simuladas; invariante 6 | ✓ |
| **3. Alojamientos** | Establecimientos, categorías, unidades, comodidades, fotos (redimensionadas antes de subir), ubicación | Desde un celular, el propietario crea y publica un establecimiento con dos unidades y fotos | — |
| **4. Motor de reservas** | `bookings` con restricción de exclusión, `create_booking`, reserva por categoría, bloqueos, provisionales y su vencimiento, check-in y check-out, grilla de ocupación y calendario mensual y semanal | Invariantes 1, 2 y 3 probados, incluida la concurrencia real | ✓ |
| **5. Tarifas y pagos** | `pricing.ts` sin efectos secundarios, ABM de reglas, precio congelado, pagos de huéspedes (seña, parciales, saldo), base de huéspedes | Tabla de casos de tarifas en verde; invariante 8; el saldo es correcto | ✓ (pagos) |
| **6. Página pública** | `/{slug}`, `public_availability`, cotización, enlace de WhatsApp, metadatos, sitemap, robots, JSON-LD | Invariante 7; Lighthouse móvil ≥ 90 en rendimiento, SEO y accesibilidad; el panel no se indexa | — |
| **7. Producción** | Supabase Pro (backups), SMTP, dominio y SSL, `/security-review`, prueba de restauración, piloto con propietarios reales | Lista de aceptación completa y aprobación del usuario | ✓ |

## Pruebas

| Nivel | Herramienta | Qué cubre |
|---|---|---|
| Unitarias | Vitest (`src/modules/**/*.test.ts`) | `pricing.ts`, validaciones Zod, cálculo de saldos y de períodos de suscripción |
| Base de datos | Vitest (`tests/db`) contra Supabase dev, con usuarios de prueba por rol y organización | RLS (invariantes 4–7), restricción de exclusión, concurrencia (`Promise.all` de N altas simultáneas), vencimientos, ciclo de vida de suscripciones |
| E2E | Playwright (`tests/e2e`), viewport móvil y de escritorio | Login → crear reserva → ver calendario; página pública → consultar fechas → enlace de WhatsApp |
| Revisión | `gga` (pre-commit), `/code-review`, 4R en fases de riesgo, `web-design-guidelines` en UI | — |

### Casos de tarifas mínimos (`pricing.test.ts`)

1. Una estadía solo con tarifa base.
2. Una estadía que cruza el inicio de una temporada (noches con precios distintos).
3. Un feriado dentro de la temporada (gana el feriado).
4. Un fin de semana en temporada (gana el fin de semana; en igualdad de prioridad, la regla más reciente).
5. Una fecha especial por encima de todo.
6. Huéspedes adicionales sobre los incluidos.
7. Estadía mínima no cumplida → error con el mínimo requerido.
8. Descuento por duración aplicado sobre el subtotal.
9. Seña redondeada a centavos según el porcentaje del establecimiento.

Los datos de prueba son siempre ficticios: nunca huéspedes reales ni credenciales de producción.
