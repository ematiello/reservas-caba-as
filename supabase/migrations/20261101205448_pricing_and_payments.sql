-- Phase 5: rates and guest payments. Rates are configuration (owner/admin of an active
-- organization). The price itself is computed by src/modules/tarifas/pricing.ts on the server and
-- frozen into bookings by a server-only service_role path (bookings_guard already rejects amount
-- writes from a user session). Guest payments are recorded by hand by any member and voided only
-- by an owner or admin; the balance is total − Σ valid payments (docs/03). Guest payments never
-- touch subscription payments (separate economic circuits).

create type public.rate_kind as enum ('base', 'season', 'weekend', 'holiday', 'special');
-- Own types, not the subscription ones: the two economic circuits stay separate.
create type public.guest_payment_kind as enum ('deposit', 'payment', 'refund');
create type public.guest_payment_method as enum ('cash', 'transfer', 'mercadopago', 'other');

-- ---------------------------------------------------------------- tables
-- National holidays, loaded by the platform admin; every property uses them.
create table public.holidays (
  date date primary key,
  name text not null check (char_length(name) between 1 and 80)
);

-- Technical caps (not commercial values): 365 nights, 50 guests (D25), priority 0–1000.
create table public.rate_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  property_id uuid not null,
  unit_id uuid,
  category_id uuid,
  kind public.rate_kind not null,
  name text not null check (char_length(name) between 1 and 80),
  -- Nights from/to, inclusive. Seasons and special dates need both; base, weekend and holiday may
  -- be narrowed to a range.
  date_from date,
  date_to date,
  price_cents bigint not null check (price_cents >= 0),
  guests_included integer check (guests_included between 1 and 50),
  extra_guest_cents bigint check (extra_guest_cents >= 0),
  min_nights integer check (min_nights between 1 and 365),
  -- Null takes the kind's default (base 0, season 10, weekend 20, holiday 30, special 40).
  priority integer check (priority between 0 and 1000),
  created_at timestamptz not null default now(),
  check (num_nonnulls(unit_id, category_id) = 1),
  check ((date_from is null) = (date_to is null)),
  check (date_to >= date_from),
  check (kind not in ('season', 'special') or date_from is not null),
  check ((guests_included is null) = (extra_guest_cents is null)),
  foreign key (org_id, property_id) references public.properties (org_id, id) on delete cascade,
  foreign key (property_id, unit_id) references public.units (property_id, id) on delete cascade,
  foreign key (property_id, category_id) references public.unit_categories (property_id, id) on delete cascade
);

create index rate_rules_property_idx on public.rate_rules (property_id);
create index rate_rules_unit_idx on public.rate_rules (unit_id) where unit_id is not null;
create index rate_rules_category_idx on public.rate_rules (category_id) where category_id is not null;
create index rate_rules_org_idx on public.rate_rules (org_id);

create table public.length_discounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  property_id uuid not null,
  min_nights integer not null check (min_nights between 2 and 365),
  pct integer not null check (pct between 1 and 100),
  created_at timestamptz not null default now(),
  unique (property_id, min_nights),
  foreign key (org_id, property_id) references public.properties (org_id, id) on delete cascade
);

create index length_discounts_org_idx on public.length_discounts (org_id);

-- Payments point at a booking of the same organization.
alter table public.bookings add constraint bookings_org_id_id_key unique (org_id, id);

create table public.booking_payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  booking_id uuid not null,
  kind public.guest_payment_kind not null,
  method public.guest_payment_method not null,
  amount_cents bigint not null check (amount_cents > 0),
  -- Copied from the booking by the guard; the client never sets it.
  currency text not null default 'ARS' check (currency ~ '^[A-Z]{3}$'),
  paid_at timestamptz not null default now(),
  reference text not null default '' check (char_length(reference) <= 200),
  recorded_by uuid references auth.users (id) on delete set null,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (org_id, booking_id) references public.bookings (org_id, id)
);

create index booking_payments_booking_idx on public.booking_payments (booking_id);
create index booking_payments_org_idx on public.booking_payments (org_id);

-- ---------------------------------------------------------------- guard
-- Insert: only on a booking (not a block); currency and author come from the server side, never
-- from the client. Update: the only change allowed is voiding, once.
create function private.booking_payments_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_booking record;
begin
  if tg_op = 'INSERT' then
    select b.kind, b.currency into v_booking
      from public.bookings b where b.org_id = new.org_id and b.id = new.booking_id;
    if not found or v_booking.kind <> 'booking' then
      raise exception 'invalid_payment' using errcode = 'P0001';
    end if;
    new.currency := v_booking.currency;
    new.recorded_by := (select auth.uid());
    new.voided_at := null;
    new.created_at := now();
    return new;
  end if;

  if new.org_id is distinct from old.org_id or new.booking_id is distinct from old.booking_id
     or new.kind is distinct from old.kind or new.method is distinct from old.method
     or new.amount_cents is distinct from old.amount_cents or new.currency is distinct from old.currency
     or new.paid_at is distinct from old.paid_at or new.reference is distinct from old.reference
     or new.recorded_by is distinct from old.recorded_by or new.created_at is distinct from old.created_at then
    raise exception 'immutable_field' using errcode = 'P0001';
  end if;
  if old.voided_at is not null then
    raise exception 'already_voided' using errcode = 'P0001';
  end if;
  if new.voided_at is not null then
    new.voided_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function private.booking_payments_guard() from public, anon, authenticated;

create trigger booking_payments_guard before insert or update on public.booking_payments
  for each row execute function private.booking_payments_guard();

-- ---------------------------------------------------------------- audit
create trigger holidays_audit after insert or update or delete on public.holidays
  for each row execute function private.audit_row();
create trigger rate_rules_audit after insert or update or delete on public.rate_rules
  for each row execute function private.audit_row();
create trigger length_discounts_audit after insert or update or delete on public.length_discounts
  for each row execute function private.audit_row();
create trigger booking_payments_audit after insert or update or delete on public.booking_payments
  for each row execute function private.audit_row();

-- ---------------------------------------------------------------- privileges and RLS
revoke all on public.holidays, public.rate_rules, public.length_discounts, public.booking_payments
  from anon, authenticated;

grant select, insert, update, delete on public.holidays to authenticated;
grant select, delete on public.rate_rules, public.length_discounts to authenticated;
grant insert (org_id, property_id, unit_id, category_id, kind, name, date_from, date_to, price_cents,
  guests_included, extra_guest_cents, min_nights, priority) on public.rate_rules to authenticated;
-- Where a rule applies (property, unit, category) is fixed once created.
grant update (kind, name, date_from, date_to, price_cents, guests_included, extra_guest_cents, min_nights,
  priority) on public.rate_rules to authenticated;
grant insert (org_id, property_id, min_nights, pct) on public.length_discounts to authenticated;
grant update (min_nights, pct) on public.length_discounts to authenticated;
-- No DELETE: a payment is voided, never erased.
grant select on public.booking_payments to authenticated;
grant insert (org_id, booking_id, kind, method, amount_cents, paid_at, reference) on public.booking_payments
  to authenticated;
grant update (voided_at) on public.booking_payments to authenticated;

alter table public.holidays enable row level security;
alter table public.rate_rules enable row level security;
alter table public.length_discounts enable row level security;
alter table public.booking_payments enable row level security;

create policy holidays_select on public.holidays for select to authenticated using (true);
create policy holidays_insert on public.holidays for insert to authenticated
  with check (private.is_platform_admin());
create policy holidays_update on public.holidays for update to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());
create policy holidays_delete on public.holidays for delete to authenticated
  using (private.is_platform_admin());

create policy rate_rules_select on public.rate_rules for select to authenticated
  using (org_id in (select private.user_org_ids()) or private.is_platform_admin());
create policy rate_rules_insert on public.rate_rules for insert to authenticated
  with check (private.can_manage_org(org_id));
create policy rate_rules_update on public.rate_rules for update to authenticated
  using (private.can_manage_org(org_id)) with check (private.can_manage_org(org_id));
create policy rate_rules_delete on public.rate_rules for delete to authenticated
  using (private.can_manage_org(org_id));

create policy length_discounts_select on public.length_discounts for select to authenticated
  using (org_id in (select private.user_org_ids()) or private.is_platform_admin());
create policy length_discounts_insert on public.length_discounts for insert to authenticated
  with check (private.can_manage_org(org_id));
create policy length_discounts_update on public.length_discounts for update to authenticated
  using (private.can_manage_org(org_id)) with check (private.can_manage_org(org_id));
create policy length_discounts_delete on public.length_discounts for delete to authenticated
  using (private.can_manage_org(org_id));

create policy booking_payments_select on public.booking_payments for select to authenticated
  using (org_id in (select private.user_org_ids()) or private.is_platform_admin());
create policy booking_payments_insert on public.booking_payments for insert to authenticated
  with check (private.can_operate_org(org_id));
create policy booking_payments_update on public.booking_payments for update to authenticated
  using (private.can_manage_org(org_id)) with check (private.can_manage_org(org_id));
