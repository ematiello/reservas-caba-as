# 03 — Modelo de datos y RLS

> Propuesta para revisar **antes** de la primera migración. Esquema `public`, claves UUID, timestamps `timestamptz` en UTC, importes `bigint` en centavos con `currency text default 'ARS'`. Extensiones: `btree_gist`, `pg_cron`.

## Entidades

```
auth.users ─┬─ profiles
            ├─ platform_admins
            └─ memberships ── organizations ─┬─ subscriptions ── subscription_payments
                                              │        └── plans (global)
                                              ├─ properties (establecimientos)
                                              │     ├─ unit_categories
                                              │     ├─ units ── unit_amenities ── amenities (global)
                                              │     ├─ media
                                              │     ├─ rate_rules · length_discounts
                                              │     └─ bookings ── booking_payments
                                              ├─ guests
                                              └─ audit_log
holidays (nacionales y por organización)
```

## Tablas

**Plataforma**
- `platform_admins(user_id pk → auth.users)`: se dan de alta y de baja desde `/admin/administradores` (`grant_platform_admin` por email, `revoke_platform_admin`; nadie se quita a sí mismo). Auditada.
- `profiles(user_id pk → auth.users, full_name, phone)`
- `plans(id, name, price_cents, currency, max_units, max_members, is_active)`: valores pendientes de decisión comercial.
- `holidays(id pk, org_id null, date, name)`, único `(org_id, date)` con nulls not distinct: `org_id` nulo = feriado nacional (lo carga el Superadmin); con `org_id`, feriado propio de la organización (owner o admin). Las tarifas usan los dos.
- `amenities(id, code unique, name)`: catálogo global.

**Organización**
- `organizations(id, name, slug unique, status enum('pending_approval','active','rejected'), approved_at, approved_by, created_at, disabled_at, disabled_by)`: `disabled_at` lo pone el Superadmin (`set_organization_disabled`) y es independiente del cobro; `org_is_active()` exige que sea nulo. El nombre lo cambia el owner y la dirección solo el Superadmin (`update_organization`).
- `memberships(org_id, user_id, role enum('owner','admin','operator'), created_at, pk(org_id,user_id))`
- `subscriptions(id, org_id unique, plan_id, status enum('trial','active','past_due','suspended','cancelled'), trial_ends_at, current_period_start date, current_period_end date, grace_days int, discount_pct numeric null, discount_cents bigint null, discount_until date null)`
- `subscription_payments(id, org_id, subscription_id, amount_cents, currency, method, paid_at, period_start, period_end, recorded_by, notes)`

**Alojamiento**
- `properties(id, org_id, slug unique, name, description, address, city, province, lat, lng, timezone default 'America/Argentina/Buenos_Aires', whatsapp, check_in_time, check_out_time, cleaning_buffer_days int default 0 check ≥0, provisional_hold_hours int default 12 check between 6 and 12, deposit_pct int default 30, weekend_days int[] default '{5,6}', is_published bool)`
- `unit_categories(id, org_id, property_id, name, description)`
- `units(id, org_id, property_id, category_id null, kind enum('cabin','house','apartment','room'), name, description, max_guests, bedrooms, beds, sort, is_published)`
- `unit_amenities(unit_id, amenity_id, pk)`
- `media(id, org_id, property_id, unit_id null, storage_path, alt, sort)`

**Tarifas**
- `rate_rules(id, org_id, property_id, unit_id null, category_id null, kind enum('base','season','weekend','holiday','special'), name, date_from date null, date_to date null, price_cents, guests_included int null, extra_guest_cents bigint null, min_nights int null, priority int, created_at)`, con check: debe indicar `unit_id` o `category_id`.
- `length_discounts(id, org_id, property_id, min_nights, pct)`

**Reservas**
- `guests(id, org_id, full_name, phone, email, notes, marketing_consent bool default false, consent_at, created_at)`: datos mínimos, sin documento en el MVP.
- `bookings`:
  - `id, org_id, property_id, unit_id, guest_id null, kind enum('booking','block')`
  - `status enum('provisional','confirmed','checked_in','checked_out','cancelled','expired')`
  - `check_in date, check_out date check (check_out > check_in)`
  - `cleaning_buffer_days int`: copiado del establecimiento al crear
  - `occupied daterange generated always as (daterange(check_in, check_out + cleaning_buffer_days, '[)')) stored`
  - `guests_count, expires_at, currency, total_cents, deposit_cents, price_breakdown jsonb, notes, created_by, created_at, updated_at`
  - **`EXCLUDE USING gist (unit_id WITH =, occupied WITH &&) WHERE (status IN ('provisional','confirmed','checked_in','checked_out'))`**
  - Índices: `(org_id, check_in)`, `(unit_id, status)`, `(status, expires_at)` donde `status = 'provisional'`.
- `booking_payments(id, org_id, booking_id, kind enum('deposit','payment','refund'), method enum('cash','transfer','mercadopago','other'), amount_cents, currency, paid_at, reference, recorded_by, voided_at null)`. El saldo se calcula como `total_cents − Σ pagos válidos`.

**Auditoría**
- `audit_log(id, org_id null, actor_id, action, table_name, record_id, diff jsonb, at)`: la llenan triggers en las tablas sensibles (`organizations`, `memberships`, `invitations`, `plans`, `platform_settings`, `platform_admins`, `subscriptions`, `subscription_payments`, `amenities`, `properties`, `unit_categories`, `units`, `bookings`, `holidays`, `rate_rules`, `length_discounts`, `booking_payments`). Es de solo inserción. Se lee con `audit_entries` (owner: su organización; Superadmin: todas) y cada vez que el Superadmin abre las reservas o los huéspedes de una organización, `log_admin_access` deja una fila `view`.

- `error_log(id, fingerprint unique, source server|browser, severity, message, detail, route, digest, org_id null, user_id null, count, first_at, last_at, status open|resolved|ignored, resolved_by, resolved_at)`: errores agrupados por huella. Solo `log_error` (service_role) escribe; solo el Superadmin lee y cambia el estado con `set_error_status` (auditado). `purge_error_log` (pg_cron, domingos) borra resueltos e ignorados a los 90 días y cualquiera a los 180. Hay un tope de 100 huellas nuevas del navegador por hora.

## Funciones

| Función | Tipo | Uso |
|---|---|---|
| `user_org_ids()` | `STABLE SECURITY DEFINER`, `search_path=''` | IDs de las organizaciones de `auth.uid()` |
| `has_org_role(org, roles[])` | `STABLE SECURITY DEFINER` | Control de rol dentro de las políticas |
| `is_platform_admin()` | `STABLE SECURITY DEFINER` | Acceso del Superadmin |
| `org_is_active(org)` | `STABLE SECURITY DEFINER` | Organización aprobada y suscripción en `trial`, `active` o `past_due` |
| `create_booking(...)` | `SECURITY INVOKER`, transaccional | Vence las provisionales caducadas de la unidad, valida capacidad y fechas, inserta y fija `expires_at` |
| `create_booking_for_category(...)` | `SECURITY INVOKER` | Prueba las unidades de la categoría en orden y captura `exclusion_violation` |
| `public_availability(slug, from, to)` | `SECURITY DEFINER`, solo lectura | Devuelve rangos ocupados por unidad publicada, **sin datos de huéspedes** |
| `expire_provisional_bookings()` | definer, `pg_cron` | Ver `02` |
| `run_subscription_lifecycle()` | definer, `pg_cron` | Ver `02` |

Las funciones `SECURITY DEFINER` se crean en un esquema no expuesto (`private`) cuando no necesitan llamarse desde el cliente. Se les revoca `EXECUTE` a `anon` cuando corresponde.

## Políticas RLS (patrón único)

RLS está habilitada en **todas** las tablas de `public`.

| Tabla | SELECT | INSERT / UPDATE / DELETE |
|---|---|---|
| Tablas con `org_id` (general) | `org_id in (select user_org_ids()) or is_platform_admin()` | miembro con el rol de la matriz de `01` **y** `org_is_active(org_id)` |
| `rate_rules`, `length_discounts`, `properties`, `units`, `unit_categories`, `media` | igual | `has_org_role(org_id, '{owner,admin}')` y organización activa |
| `bookings`, `guests`, `booking_payments` (alta) | igual | cualquier rol y organización activa. Anular pagos: `owner` o `admin` |
| `memberships` | miembros de la organización | `owner` |
| `subscriptions`, `subscription_payments` | `owner` de la organización, o Superadmin | solo Superadmin |
| `organizations` | miembros, o Superadmin | alta por registro (queda `pending_approval`). Aprobar, rechazar y suspender: solo Superadmin |
| `plans`, `amenities` | todos los autenticados (`plans` también `anon`, para la página de precios) | solo Superadmin |
| `holidays` | nacionales: todos; propios: miembros de la organización, o Superadmin | nacionales: solo Superadmin; propios: `owner` o `admin` (`can_manage_org`) |
| `audit_log` | `owner` de la organización, o Superadmin | sin políticas de escritura (solo triggers) |
| `error_log` | Superadmin | sin políticas de escritura (solo `log_error` con `service_role`) |
| **Público (`anon`)** | `properties`, `units`, `media`, `rate_rules`, `length_discounts`, `unit_categories`, `unit_amenities`, `amenities`: solo si `is_published` y `org_is_active`; `holidays` nacionales y los de organizaciones con una página pública. Disponibilidad y estado de la página solo por `public_availability` y `public_property_state` | nada |

**Storage:** bucket `media` público para lectura, con ruta `{org_id}/{property_id}/...`. Para escribir hay que ser miembro con rol `owner` o `admin` de la organización que figura en el primer segmento de la ruta.

## Invariantes que deben tener prueba

1. Dos `create_booking` concurrentes para la misma unidad y fechas que se superponen: entra uno solo.
2. Una provisional vencida no bloquea, aunque `pg_cron` todavía no haya corrido.
3. Si la estadía A termina el día 13 y la B empieza el 13: se permite con buffer 0 y se rechaza con buffer 1.
4. Un usuario de la organización A no puede leer ni escribir nada de la organización B, en ninguna tabla.
5. Un `operator` no puede modificar tarifas, unidades ni membresías.
6. Con la organización suspendida: lectura sí, escritura no. La página pública no muestra nada.
7. `anon` no ve huéspedes, reservas ni pagos. `public_availability` no expone datos personales.
8. El precio congelado de una reserva no cambia cuando se edita una tarifa.
