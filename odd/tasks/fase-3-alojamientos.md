# Fase 3 — Alojamientos
Objetivo: establecimientos, categorías, unidades, comodidades, fotos (redimensionadas en el navegador antes de subir) y ubicación. Ramas apiladas sobre la Fase 2: `feat/fase-3-a-db` → `feat/fase-3-b-ui`. Entrega: `stacked-to-main`. Runner: Vitest (`tests/db/**` contra dev) y Playwright (móvil y escritorio).

## Specs
- S1. De `docs/04`, entrega: "Establecimientos, categorías, unidades, comodidades, fotos (redimensionadas antes de subir), ubicación".
- S2. Criterio de salida: "Desde un celular, el propietario crea y publica un establecimiento con dos unidades y fotos".
- S3. Esquema (`docs/03`): `properties(id, org_id, slug unique, name, description, address, city, province, lat, lng, timezone default 'America/Argentina/Buenos_Aires', whatsapp, check_in_time, check_out_time, cleaning_buffer_days int default 0 check ≥0, provisional_hold_hours int default 12 check between 6 and 12, deposit_pct int default 30, weekend_days int[] default '{5,6}', is_published bool)`; `unit_categories(id, org_id, property_id, name, description)`; `units(id, org_id, property_id, category_id null, kind enum('cabin','house','apartment','room'), name, description, max_guests, bedrooms, beds, sort, is_published)`; `unit_amenities(unit_id, amenity_id, pk)`; `media(id, org_id, property_id, unit_id null, storage_path, alt, sort)`; `amenities(id, code unique, name)` global.
- S4. RLS (`docs/03`): lectura de miembros o Superadmin; escritura `has_org_role(org_id, '{owner,admin}')` y organización activa; `anon` lee `properties`, `units`, `media`, `amenities` "solo si `is_published` y `org_is_active`". Storage: "bucket `media` público para lectura, con ruta `{org_id}/{property_id}/...`. Para escribir hay que ser miembro con rol `owner` o `admin` de la organización que figura en el primer segmento de la ruta."
- S5. Invariantes 4, 5 y 6 sobre las tablas nuevas: aislamiento entre organizaciones, "Un `operator` no puede modificar tarifas, unidades ni membresías", suspendida = solo lectura.
- S6. "Inventario de hoteles: cada habitación es una unidad física; la categoría solo agrupa." El límite `max_units` del plan (Fase 2) se aplica al crear unidades.
- S7. Imágenes en Supabase Storage, redimensionadas en el navegador, nunca en el disco de Hostinger (`CLAUDE.md`).

## Tasks
- T1 (S3-S6) Migración: tablas, FKs compuestas por organización, catálogo de comodidades, tope de unidades con bloqueo, bucket `media` y sus políticas, RLS. Ruta: inline. PENDIENTE.
- T2 (S4-S6) Pruebas de BD (aislamiento, operador, suspendida, `anon`, FKs cruzadas, tope y concurrencia, Storage). Ruta: inline. PENDIENTE.
- T3 (S1,S7) Redimensionado de imágenes en el navegador (función pura de medidas, TDD) y subida a Storage. Ruta: inline. PENDIENTE.
- T4 (S1,S2) UI `/panel/alojamientos`: establecimiento (datos, ubicación, publicación), categorías, unidades con comodidades, fotos. Ruta: inline. PENDIENTE.
- T5 (S2) e2e móvil del criterio de salida, docs, revisión. Ruta: inline. PENDIENTE.

## Log
- L1 (2026-11-01, usuario): "seguí con la implementación de las fases"
- L2: Supuestos: el slug de establecimiento es único global con las mismas palabras reservadas que el de organización (`docs/03` dice `slug unique`); la URL pública se define en la Fase 6. Las tablas nuevas llevan `org_id` con FK compuesta `(org_id, property_id)` para que una fila nunca apunte a otra organización. Comodidades: catálogo inicial sembrado en la migración (no es un valor comercial). Sin auditoría en estas tablas (`docs/03` no las lista). Espejo en Engram pendiente.
