# Fase 1 — Organizaciones y acceso
Objetivo: tablas de plataforma y organización, funciones de control, registro/login (Auth SSR), aprobación del Superadmin, colaboradores con roles y auditoría. Rama: `feat/fase-1-organizaciones-acceso`. Entrega: `ask-on-risk`. Runner: Vitest (`tests/db/**`, contra el proyecto dev `uqgmtcmdaxruiwkawxxx`) y Playwright.

## Specs
- S1. De `docs/04-plan-y-pruebas.md`, entrega: "Tablas de plataforma y organización, `user_org_ids()` y demás funciones de control, registro y login (Auth SSR), aprobación por el Superadmin, colaboradores con roles, auditoría".
- S2. Criterio de salida: "Invariantes 4 y 5 de `03` probados; las rutas `/panel` y `/admin` están protegidas en el servidor". Revisión 4R: obligatoria (migraciones/RLS, autenticación).
- S3. Invariante 4: "Un usuario de la organización A no puede leer ni escribir nada de la organización B, en ninguna tabla."
- S4. Invariante 5: "Un `operator` no puede modificar tarifas, unidades ni membresías." (En esta fase solo existen membresías y organización; tarifas y unidades se prueban cuando existan.)
- S5. Esquema según `docs/03`: `platform_admins`, `profiles`, `organizations` (`pending_approval`/`active`/`rejected`), `memberships` (`owner`/`admin`/`operator`), `audit_log` (solo inserción, la llenan triggers). Funciones `user_org_ids()`, `has_org_role()`, `is_platform_admin()` con `SECURITY DEFINER`, `search_path=''`. RLS en todas las tablas.
- S6. Registro de propietario → organización en `pending_approval` → aprobación del Superadmin (`docs/01`, alcance 1). Rol `owner` para quien registra; colaboradores `admin`/`operator` los gestiona solo el `owner`.
- S8. Decisión del usuario: invitación de colaboradores "Por enlace de invitacion por whatsapp". El `owner` genera un enlace con rol (`admin`/`operator`) y vencimiento; se guarda solo el hash del token; quien lo abre, ya autenticado, lo acepta y queda como miembro. Sin SMTP. (Supuesto: vence a los 7 días y es de un solo uso.)
- S7. Supuesto (a confirmar): `org_is_active(org)` se define aquí solo con el estado de la organización (`active`); la suscripción se suma en la Fase 2.

## Tasks
- T1 (S1,S5,S8) Migración `20261031155239_organizations_and_access.sql`: enums, tablas, `invitations`, funciones en `private`, RPC, RLS, triggers de auditoría. Ruta: inline. HECHA: aplicada al proyecto dev; tipos regenerados.
- T2 (S3,S4,S6,S8) Pruebas de BD primero: `tests/db/organizations-access.test.ts`. Ruta: inline. HECHA. RED: `PGRST202` función inexistente antes de la migración. GREEN: 22/22 (dos corridas), lint y typecheck OK.
- T3 (S1,S6) Auth SSR: registro, login, logout (Zod + server actions), `/auth/confirm`, alta de organización diferida hasta tener sesión. Ruta: inline. HECHA (código): 25 pruebas puras nuevas + 2 de perfiles, typecheck, lint y build OK. PENDIENTE: prueba manual/E2E del flujo real (depende de si el proyecto dev exige confirmación por email; se cierra en T7).
- T4 (S2) Protección en servidor de `/panel` y `/admin`; pantallas sin negocio / pendiente / rechazado / activo. Ruta: inline. HECHA: `session.ts` (capa de acceso que cada página invoca), `panel-state.ts` (TDD, 6 pruebas), e2e `tests/e2e/access.spec.ts` (anónimo → login con `next`; sin contenido privado en el HTML; usuario común → 404 en `/admin`; Superadmin accede; flujo pendiente → aprobado; logout). Móvil 11/11, escritorio 11/11, Vitest 55/55, lint y typecheck OK.
- T5 (S6) Superadmin: listar, aprobar y rechazar organizaciones. Pendiente.
- T6 (S6,S8) Colaboradores: invitación por enlace, aceptación, cambio de rol y baja (solo `owner`). Pendiente.
- T7 (S2) E2E, docs, `/security-review` y revisión 4R con verificador independiente. Pendiente.

## Log
- L1 (2026-10-30, usuario): "aprendamos del proceso de fases para repetirlo mas rapido y con menos gastos. Arranquemos con la fase 1"
- L2: Lecciones de la Fase 0 guardadas en memoria (`fase-0-lecciones-proceso`). Espejo en Engram pendiente: no hay herramientas de Engram disponibles en esta sesión.
- L3: Decisión abierta antes de T6: cómo se invita a un colaborador (SMTP sin definir).
- L6: Desvío respecto de `docs/03`: `memberships` no tiene política de INSERT; las altas pasan solo por `register_organization` y `accept_invitation` (el owner no puede agregar a un usuario sin su consentimiento). El owner puede cambiar rol/baja solo de `admin`/`operator`, nunca de un `owner`. Flaky corregido en la prueba de vencimiento (reloj local vs servidor).
- L7: Registro: nombre del negocio y slug viajan en `user_metadata` del signUp; `register_organization` se llama cuando hay sesión (al registrarse si no hay confirmación por email; si no, en `/auth/confirm` o en el primer login). Si el slug ya existe queda sin organización: T4 debe ofrecer crear el negocio desde `/panel`. Se omitió React Hook Form: `useActionState` + Zod alcanza. `/panel` es un placeholder hasta T4.
- L8: Con `cacheComponents` la sesión se lee detrás de `<Suspense>`, así que la redirección a login y el 404 de `/admin` llegan con la página ya en streaming (el contenido privado nunca se envía; verificado en e2e), no como un 307/404 de cabecera. El cliente de Supabase usa `Date.now()` al inicializar: `getAccess` llama `connection()` primero (sin eso, error por request en el log). `getAccess` filtra memberships por `user_id`: el Superadmin lee todas por RLS.
- L5 (2026-10-31, usuario): "Sí, seed manual" → el primer Superadmin se crea con un INSERT manual en `platform_admins` (fuera de las migraciones).
- L4 (2026-10-31, usuario): "Por enlace de invitacion por whatsapp" → S8; desbloquea T6. Registrada como D21.
