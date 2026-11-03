# Fase 2 — Suscripciones
Objetivo: planes, suscripción con prueba de 7 días, pagos manuales, días de gracia, descuentos, ciclo de vida con `pg_cron` y suspensión con `org_is_active()`. Ramas apiladas sobre la Fase 1: `feat/fase-2-a-db` (base de datos) → `feat/fase-2-b-ui` (admin y panel). Entrega: `stacked-to-main` (estrategia ya elegida en la Fase 1, L9 de ese documento). Runner: Vitest (`tests/db/**` contra el proyecto dev) y Playwright.

## Specs
- S1. De `docs/04-plan-y-pruebas.md`, entrega: "Planes, suscripción, prueba de 7 días, pagos manuales, días de gracia, descuentos, `run_subscription_lifecycle()` con `pg_cron`, suspensión con `org_is_active()`".
- S2. Criterio de salida: "Transiciones de estado probadas con fechas simuladas; invariante 6". Revisión 4R: obligatoria.
- S3. Invariante 6 (`docs/03`): "Con la organización suspendida: lectura sí, escritura no. La página pública no muestra nada." (La página pública llega en la Fase 6.)
- S4. Reglas (`docs/01`): "Estados: `trial` (7 días) → `active` → `past_due` (vencida, dentro de los días de gracia) → `suspended`. También existe `cancelled`." "Período mensual **por aniversario**, contado desde la fecha de activación." "Al registrar un pago, el período se extiende y una cuenta suspendida se reactiva." "Descuento personalizado por organización: porcentaje o monto, con fecha de vencimiento opcional."
- S5. `docs/02`: `run_subscription_lifecycle()` diaria 03:00 ART: "trial/active vencidas → `past_due`; vencidas tras los días de gracia → `suspended`". Idempotente.
- S6. Decisión del usuario (L2): "Sí, editables desde /admin" → precio y límites de cada plan y días de gracia son datos que el Superadmin carga y edita en `/admin`; no hay valores comerciales en el código. Las pruebas usan valores ficticios.
- S7. Permisos (`docs/03`): `subscriptions`, `subscription_payments`: lectura del `owner` o Superadmin; escritura solo Superadmin. `plans`: lectura de todos (también `anon`); escritura solo Superadmin. Auditoría por triggers en `subscriptions` y `subscription_payments`.

## Tasks
- T1 (S1,S4-S7) Migración: `plans`, `platform_settings`, `subscriptions`, `subscription_payments`, `org_is_active()` con suscripción, `review_organization` con plan, `record_subscription_payment`, `suspend_subscription`, `run_subscription_lifecycle(p_today)`, `pg_cron`, límite de colaboradores en `accept_invitation`, auditoría, RLS. Ruta: inline. PENDIENTE.
- T2 (S2-S5,S7) Pruebas de BD con fechas simuladas e invariante 6. Ruta: inline. PENDIENTE.
- T3 (S4) `billing.ts`: importe a cobrar con descuento vigente (función pura, TDD). Ruta: inline. PENDIENTE.
- T4 (S6,S7) `/admin`: planes, ajustes (prueba y gracia), aprobación con plan, ficha de organización (pago, descuento, gracia, plan, suspensión). Ruta: inline. PENDIENTE.
- T5 (S3,S7) Panel: `/panel/suscripcion` para el owner; aviso de solo lectura con la cuenta suspendida. Ruta: inline. PENDIENTE.
- T6 (S2) e2e, docs (D22-D23), revisión. Ruta: inline. PENDIENTE.

## Log
- L1 (2026-11-01, usuario): "El diseño del sitio es un asco, vamos a mejorarlo mas adelante. continuemos con toda implementacion de las fases"
- L2 (2026-11-01, usuario): "Sí, editables desde /admin, seguí con la implementacion de la fase"
- L3: Supuestos de diseño (registrados como D22-D23): el Superadmin elige el plan al aprobar (opcional, se puede asignar después) en lugar de que el propietario lo elija al registrarse; `org_is_active()` evalúa también la fecha (`hoy < fin del período + días de gracia`), así la suspensión rige aunque `pg_cron` no haya corrido; `platform_settings.default_grace_days` arranca en 0 como valor provisorio que el Superadmin edita; las organizaciones ya activas de la Fase 1 reciben una prueba al aplicar la migración. Espejo en Engram pendiente (herramientas no disponibles).
