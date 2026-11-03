# Pendientes técnicos (P1–P25)

Objetivo: cerrar uno por uno los seguimientos de `docs/06-pendientes-tecnicos.md`. Rama `fix/pendientes-tecnicos` (apilada sobre `feat/gestion-propietario-superadmin`). Entrega: un commit por pendiente (o grupo chico del mismo archivo), estrategia `ask-on-risk`. Pruebas: Vitest (`npm test`), Playwright solo si toca flujos.

## Specs

- S1: "Resolver los pendientes tecnicos uno por uno" — cada fila de `docs/06-pendientes-tecnicos.md` se resuelve (código + prueba cuando aplica) y su Estado pasa a llevar el commit; las que dependen de una decisión del usuario o de algo externo quedan anotadas con el motivo.

## Tasks

| ID | Pendiente | Ruta | Estado | Commit |
|----|-----------|------|--------|--------|
| T1 | P1 mensaje propio para 429 en login | inline | hecho (RED→GREEN) | a232ae1 |
| T2 | P2 `completePendingRegistration` errores ignorados | inline | hecho (RED→GREEN) | a232ae1 |
| T3 | P3 `removeMemberAction`/`changeMemberRoleAction` ignoran error | inline | hecho (e2e ampliado, no corrido) | 1796e75, bfa0260 |
| T4 | P4 `/auth/confirm` consume token en GET | inline | hecho (prueba escrita junto al código, sin RED aislado) | 88e09ff |
| T5 | P5 `NEXT_PUBLIC_SITE_URL` en producción | inline | hecho (RED→GREEN) | 80b41a3 |
| T6 | P6 registro real por email | — | bloqueado: SMTP | |
| T7 | P7 bucket `media` público | inline | cerrado: riesgo aceptado (D29) | ver commit docs D29 |
| T8 | P8–P10 archivos huérfanos en Storage | inline | hecho (P8 ya estaba; RED→GREEN en uploader) | 9d71424, ebba50a |
| T9 | P11 `publicMediaUrl` sin URL | inline | hecho (RED→GREEN) | 6c697a8 |
| T10 | P12 `sort` con subidas simultáneas | inline | hecho (RED→GREEN, BD dev) | d3d5dee |
| T11 | P13 código de error para tope de unidades | inline | hecho (RED→GREEN, BD dev) | d3d5dee |
| T12 | P14 `updateUnitAction` filtra por establecimiento | inline | hecho (typecheck) | 98d379a |
| T13 | P15 validar zona IANA | inline | hecho (RED→GREEN, BD dev) | 9cf3aaf |
| T14 | P16 `crypto.randomUUID` fuera de contexto seguro | inline | hecho (RED→GREEN) | 9d71424 |
| T15 | P17 server standalone sale con 127 | inline | mitigado, no reproducido | — |
| T16 | P18 registro del español / RHF | — | decisión del usuario | |
| T17 | P20 prueba `anon` de bookings | inline | hecho | 794154f |
| T18 | P21 `bookings_guard` y `expires_at` | inline | hecho (RED→GREEN, BD dev) | d3d5dee |
| T19 | P22 `BookingStatus` desde los tipos generados | inline | hecho | 5d52851 |
| T20 | P23 `actionsFor` duplica transiciones | inline | hecho (prueba de conformidad con la BD) | 5d52851 |
| T21 | P24 variable sin uso en test | inline | hecho | 794154f |
| T22 | P25 índices de FKs | inline | evaluado, sin cambios | — |
| T23 | P19 espejo Engram | — | herramienta no disponible | |

## Log

- L1 (2026-11-03): "Resolver los pendientes tecnicos uno por uno"
- L2: migraciones `20261103111035_review_followups_sort_unit_cap_hold` y `20261103111439_property_timezone_check` aplicadas al proyecto dev con `supabase db push` (aditivas; reversión anotada en cada archivo). Falta aplicarlas en producción cuando exista.
- L3: la prueba de conformidad de P23 encontró que escribir el mismo estado es un no-op aceptado por la base; se excluye de la comparación.
- L4: hallazgo nuevo P26 (deadlock `40P01` intermitente en altas concurrentes): resuelto en `c891f0e` con advisory lock por unidad en `bookings_guard` (migración `20261103112449`, aplicada a dev); prueba de concurrencia 6/6 y suite de BD 150/150.
- L5: P7 necesita decisión: (a) aceptar el riesgo (UUID no adivinable) y documentarlo, o (b) bucket privado con URLs firmadas (rompe la caché de la portada estática y cambia la página pública).
- L6 (2026-11-03): "a, documentalo" → P7 cerrado como riesgo aceptado, decisión D29 en `docs/05-decisiones.md`.
- L7 (2026-11-03): "mantené el voseo" → D30. De P18 queda abierta la parte de React Hook Form.
- Siguiente: decisión de RHF (P18); e2e completo y revisión profunda antes de integrar la rama.
