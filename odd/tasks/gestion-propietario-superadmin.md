# Management features for owners and the platform admin

Objective: the missing management screens so the system can be shown to a client. Branch
`feat/gestion-propietario-superadmin` (stacked on `feat/fase-6-d-diseno-panel`). Delivery: single PR,
work-unit commits. Runner: Vitest (DB tests against dev) and Playwright.

## Specs

Owner ("Empecemos por esto del propietario"):

- S1 "Editar los datos de la organización. docs/01 lo asigna al owner y no hay pantalla."
- S2 "Borrar un establecimiento. No hay acción."
- S3 "Editar una categoría. Solo se crea o se borra."
- S4 "Ver la auditoría de sus propias acciones."
- S5 "Cancelar la suscripción."
- S6 "Cargar feriados. Hoy solo lo hace el superadmin, y eso es una decisión tuya."

Superadmin ("y sigamos por esto del Superadmin"):

- S7 "Reactivar la cuenta con un botón. Hoy solo se reactiva registrando un pago."
- S8 "Cancelar una suscripción. El estado existe, pero no hay acción."
- S9 "Ver audit_log. La tabla existe, la invariante exige auditar, y no hay pantalla para leerla."
- S10 "Ver la operación de una organización (reservas y huéspedes). Hoy no hay forma de hacerlo desde el superadmin."
- S11 "Dar de alta otro superadmin. Hoy se hace en SQL."
- S12 "Editar o desactivar una organización."

Decisions taken without asking (the user asked not to be interrupted; listed for review):

- S1: the owner edits the name; the public address (slug) only the platform admin, since it breaks shared links.
- S2: only without bookings or blocks (bookings are history, no cascade); otherwise "despublicalo". Confirmation checkbox.
- S5: status `cancelled`, panel read-only, public page "no disponible", data kept; only the platform admin brings it back.
- S6: national holidays (platform admin) plus holidays per organization (owner/admin); pricing uses both.
- S7: reactivation without payment until a date the platform admin picks (no invented period).
- S10: read-only lists; every opening is recorded in the audit log (`view`).
- S11: by the email of an existing account; removal of others allowed, never oneself.
- S12: deactivation is an organization flag (`disabled_at`), separate from billing: a payment does not turn it back on.

## Tasks

- [x] T1 S1,S5-S9,S11,S12 DB: migration `20261102165721_management.sql`, `tests/db/management.test.ts` (RED 22 failed → GREEN 22/22), types, pricing holidays per org — inline
- [x] T2 S1-S6 owner UI: organization, activity, holidays, cancel, delete property, edit category — inline
- [x] T3 S4,S7-S12 admin UI: org detail actions, activity, administrators, bookings/guests read-only; audit triggers on properties, categories and units (`20261102204243_accommodations_audit.sql`, DB test 23/23) — inline
- [x] T4 e2e (`tests/e2e/management.spec.ts`, with `subscriptions.spec.ts`: 16/16 mobile and desktop) and docs (docs/03, D27, CLAUDE.md) — inline

## Log

- L1 (2026-11-02) User request: "Empecemos por esto del propietario:Lo que falta: - Editar los datos de la organización. docs/01 lo asigna al owner y no hay pantalla. - Borrar un establecimiento. No hay acción. - Editar una categoría. Solo se crea o se borra. - Ver la auditoría de sus propias acciones. - Cancelar la suscripción. - Cargar feriados. Hoy solo lo hace el superadmin, y eso es una decisión tuya. y sigamos por esto del Superadmin Lo que falta: - Reactivar la cuenta con un botón. Hoy solo se reactiva registrando un pago. - Cancelar una suscripción. El estado existe, pero no hay acción. - Ver audit_log. La tabla existe, la invariante exige auditar, y no hay pantalla para leerla. - Ver la operación de una organización (reservas y huéspedes). Hoy no hay forma de hacerlo desde el superadmin. - Dar de alta otro superadmin. Hoy se hace en SQL. - Editar o desactivar una organización. Lo hagamos asi puedo mostrarle el sistema a un cliente"
- L2 RLS already let owners read their audit rows and the platform admin read bookings/guests; the gaps were RPCs, holidays scope and screens.
- L3 Migration pushed to dev; DB test 22/22. A RED run left a national holiday behind (column missing then); the test now clears it first.
- L4 The owner activity showed no property changes: properties, categories and units had no audit trigger. Added them (additive migration); media stays unaudited. The DB test was written after the push, so no RED was observed for it.
- L5 Reactivation asks for the last active day; the action sends the next day because the period end is exclusive. Reading bookings or guests as admin writes the `view` row first and fails closed.
- L6 Checks: typecheck, lint (0 errors), `vitest run src` 204/204, DB management 23/23, e2e management + subscriptions 16/16.
- L7 Independent verifier: PASS, no blockers (S1-S12 met; DB 23/23, unit 204/204). Fixed advisory 5 (public listing cache tag on org state changes). Open advisories: owners still get the platform actor_id (name hidden); former members' past actions read as "Plataforma"; storage removal errors after deleting a property are not logged.
- L8 (2026-11-03) User: "Si, corrige todo" (after /code-review). Fixed: reactivation copy explains the grace days (same as a payment); cancel card hidden for suspended subscriptions; revoke_platform_admin locks and refuses the last admin (P0003); audit_entries adds actor_kind, hides platform ids (actor_id, approved_by, disabled_by, recorded_by) from owners and keeps former collaborators' names; index (org_id, id desc); orphan photo removal logged; admin views load only the org name; shared done() helper in src/lib/action-result.ts. Migration 20261103013836_review_fixes.sql pushed to dev. RED: the two audit tests failed before the push; the concurrent revoke test passed before too (the race did not reproduce), kept as regression. GREEN: DB 26/26, unit 206/206. Commits e5f90e0, ecc44c5. .env.example left untouched (the user's own change).
