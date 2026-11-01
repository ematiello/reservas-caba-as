-- Phase 4: booking engine. Bookings and manual blocks share one table; an exclusion constraint on
-- (unit, occupied range) makes overlaps impossible in the database, also under concurrency
-- (invariants 1 and 3). Every rule lives in a BEFORE trigger, so it holds for direct writes too
-- (RLS lets any member of an active organization write): capacity, copying the property's cleaning
-- buffer and hold hours, state transitions, fixed fields, and expiring the unit's stale
-- provisionals before a write so an expired hold never blocks, even before pg_cron runs (invariant 2).

create extension if not exists btree_gist with schema extensions;

create type public.booking_kind as enum ('booking', 'block');
create type public.booking_status as enum ('provisional', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'expired');

-- ---------------------------------------------------------------- tables
create table public.guests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 120),
  phone text check (phone is null or char_length(phone) <= 40),
  email text check (email is null or char_length(email) <= 200),
  notes text not null default '' check (char_length(notes) <= 2000),
  marketing_consent boolean not null default false,
  consent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, id)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  property_id uuid not null,
  unit_id uuid not null,
  guest_id uuid,
  kind public.booking_kind not null default 'booking',
  status public.booking_status not null,
  check_in date not null,
  check_out date not null,
  -- Copied from the property when the booking is created (docs/01); later changes do not apply.
  cleaning_buffer_days integer not null default 0 check (cleaning_buffer_days >= 0),
  occupied daterange generated always as (daterange(check_in, check_out + cleaning_buffer_days, '[)')) stored,
  guests_count integer check (guests_count is null or guests_count >= 1),
  expires_at timestamptz,
  -- Price, deposit and breakdown are computed and frozen in Phase 5.
  currency text not null default 'ARS' check (currency ~ '^[A-Z]{3}$'),
  total_cents bigint check (total_cents is null or total_cents >= 0),
  deposit_cents bigint check (deposit_cents is null or deposit_cents >= 0),
  price_breakdown jsonb,
  notes text not null default '' check (char_length(notes) <= 2000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (check_out > check_in),
  check (status <> 'provisional' or expires_at is not null),
  check (
    (kind = 'booking' and guests_count is not null)
    or (kind = 'block' and guests_count is null and guest_id is null)
  ),
  -- NO ACTION (not RESTRICT): deleting the organization cascades through properties and bookings in
  -- the same statement, while deleting a unit or property that still has bookings fails.
  foreign key (org_id, property_id) references public.properties (org_id, id),
  foreign key (property_id, unit_id) references public.units (property_id, id),
  foreign key (org_id, guest_id) references public.guests (org_id, id),
  constraint bookings_no_overlap exclude using gist (unit_id with =, occupied with &&)
    where (status in ('provisional', 'confirmed', 'checked_in', 'checked_out'))
);

create index bookings_org_check_in_idx on public.bookings (org_id, check_in);
create index bookings_unit_status_idx on public.bookings (unit_id, status);
create index bookings_provisional_expiry_idx on public.bookings (status, expires_at) where status = 'provisional';
create index bookings_guest_idx on public.bookings (guest_id) where guest_id is not null;
create index guests_org_idx on public.guests (org_id);

-- ---------------------------------------------------------------- functions
-- Any member (owner, admin or operator) of an active organization: who may write bookings (docs/01).
create function private.can_operate_org(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_org_role(p_org, array['owner', 'admin', 'operator']::public.member_role[])
     and private.org_is_active(p_org);
$$;

-- Provisionals of this unit whose hold ran out stop blocking before anything else is written.
create function private.expire_stale_provisionals(p_unit uuid, p_except uuid)
returns void language sql security definer set search_path = '' as $$
  update public.bookings
     set status = 'expired'
   where unit_id = p_unit and status = 'provisional' and expires_at <= now() and id <> p_except;
$$;

create function private.bookings_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_unit record;
  v_moved boolean;
begin
  if tg_op = 'INSERT' then
    select u.org_id, u.property_id, u.max_guests, p.provisional_hold_hours, p.cleaning_buffer_days
      into v_unit
      from public.units u join public.properties p on p.id = u.property_id
     where u.id = new.unit_id;
    if not found or v_unit.org_id <> new.org_id then
      raise exception 'unit_not_found' using errcode = 'P0001';
    end if;
    if new.status not in ('provisional', 'confirmed') then
      raise exception 'invalid_status' using errcode = 'P0001';
    end if;
    if new.kind = 'block' and new.status <> 'confirmed' then
      raise exception 'invalid_status' using errcode = 'P0001';
    end if;
    new.property_id := v_unit.property_id;
    new.cleaning_buffer_days := v_unit.cleaning_buffer_days;
    new.expires_at := case when new.status = 'provisional'
                           then now() + make_interval(hours => v_unit.provisional_hold_hours) end;
    new.created_by := (select auth.uid());
    new.created_at := now();
    new.updated_at := now();
    v_moved := true;
  else
    if new.org_id is distinct from old.org_id or new.property_id is distinct from old.property_id
       or new.kind is distinct from old.kind or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at
       or new.cleaning_buffer_days is distinct from old.cleaning_buffer_days then
      raise exception 'immutable_field' using errcode = 'P0001';
    end if;

    if new.status is distinct from old.status then
      if not (
           (old.status = 'provisional' and new.status in ('confirmed', 'cancelled', 'expired'))
        or (old.status = 'confirmed' and new.status = 'cancelled')
        or (old.status = 'confirmed' and new.kind = 'booking' and new.status = 'checked_in')
        or (old.status = 'checked_in' and new.status = 'checked_out')
      ) then
        raise exception 'invalid_transition' using errcode = 'P0001';
      end if;
      if old.status = 'provisional' and new.status = 'confirmed' and old.expires_at <= now() then
        raise exception 'provisional_expired' using errcode = 'P0001';
      end if;
      if new.status = 'expired' and old.expires_at > now() then
        raise exception 'invalid_transition' using errcode = 'P0001';
      end if;
      if new.status = 'confirmed' then
        new.expires_at := null;
      end if;
    elsif new.expires_at is distinct from old.expires_at and (select auth.uid()) is not null then
      -- Only internal jobs (no user session) move a hold.
      raise exception 'immutable_field' using errcode = 'P0001';
    end if;

    v_moved := new.unit_id is distinct from old.unit_id or new.check_in is distinct from old.check_in
            or new.check_out is distinct from old.check_out
            or new.guests_count is distinct from old.guests_count;
    if v_moved then
      if new.status not in ('provisional', 'confirmed', 'checked_in') then
        raise exception 'invalid_transition' using errcode = 'P0001';
      end if;
      select u.org_id, u.property_id, u.max_guests into v_unit
        from public.units u where u.id = new.unit_id;
      if not found or v_unit.property_id <> new.property_id then
        raise exception 'unit_not_found' using errcode = 'P0001';
      end if;
    end if;
  end if;

  if v_moved then
    if new.check_out <= new.check_in then
      raise exception 'invalid_dates' using errcode = 'P0001';
    end if;
    if new.kind = 'booking' and (new.guests_count is null or new.guests_count > v_unit.max_guests) then
      raise exception 'capacity_exceeded' using errcode = 'P0001';
    end if;
    perform private.expire_stale_provisionals(new.unit_id, new.id);
  end if;
  return new;
end;
$$;

revoke execute on function private.can_operate_org(uuid), private.expire_stale_provisionals(uuid, uuid),
  private.bookings_guard() from public, anon, authenticated;
grant execute on function private.can_operate_org(uuid) to authenticated;

-- Creates a booking or a block on one unit. Invoker rights: RLS decides who may do it.
create function public.create_booking(
  p_unit uuid,
  p_check_in date,
  p_check_out date,
  p_kind public.booking_kind default 'booking',
  p_status public.booking_status default 'provisional',
  p_guests_count integer default null,
  p_guest_name text default null,
  p_guest_phone text default null,
  p_guest_email text default null,
  p_notes text default ''
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_org uuid;
  v_property uuid;
  v_guest uuid;
  v_id uuid;
begin
  select u.org_id, u.property_id into v_org, v_property
    from public.units u
   where u.id = p_unit and u.org_id in (select private.user_org_ids());
  if v_org is null then
    raise exception 'unit_not_found' using errcode = 'P0001';
  end if;
  if p_check_in is null or p_check_out is null or p_check_out <= p_check_in then
    raise exception 'invalid_dates' using errcode = 'P0001';
  end if;

  if p_kind = 'booking' and nullif(btrim(p_guest_name), '') is not null then
    insert into public.guests (org_id, full_name, phone, email)
    values (v_org, btrim(p_guest_name), nullif(btrim(p_guest_phone), ''), nullif(btrim(p_guest_email), ''))
    returning id into v_guest;
  end if;

  insert into public.bookings (org_id, property_id, unit_id, guest_id, kind, status, check_in, check_out, guests_count, notes)
  values (
    v_org, v_property, p_unit, v_guest, p_kind,
    case when p_kind = 'block' then 'confirmed'::public.booking_status else p_status end,
    p_check_in, p_check_out,
    case when p_kind = 'block' then null else p_guests_count end,
    coalesce(p_notes, '')
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- Hotels: tries the category's units in order and keeps the first one free (docs/01). A unit taken
-- by a concurrent request raises exclusion_violation, which only rolls back that attempt.
create function public.create_booking_for_category(
  p_category uuid,
  p_check_in date,
  p_check_out date,
  p_guests_count integer,
  p_guest_name text default null,
  p_guest_phone text default null,
  p_guest_email text default null,
  p_status public.booking_status default 'provisional',
  p_notes text default ''
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_unit uuid;
  v_fits boolean := false;
begin
  if not exists (
    select 1 from public.unit_categories c
     where c.id = p_category and c.org_id in (select private.user_org_ids())
  ) then
    raise exception 'category_not_found' using errcode = 'P0001';
  end if;

  for v_unit in
    select u.id from public.units u
     where u.category_id = p_category and u.max_guests >= p_guests_count
     order by u.sort, u.name, u.id
  loop
    v_fits := true;
    begin
      return public.create_booking(v_unit, p_check_in, p_check_out, 'booking', p_status, p_guests_count,
                                   p_guest_name, p_guest_phone, p_guest_email, p_notes);
    exception when exclusion_violation then
      null;
    end;
  end loop;

  if not v_fits then
    raise exception 'capacity_exceeded' using errcode = 'P0001';
  end if;
  raise exception 'no_unit_available' using errcode = 'P0001';
end;
$$;

-- pg_cron, every 5 minutes (docs/02). Idempotent.
create function public.expire_provisional_bookings()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  update public.bookings set status = 'expired' where status = 'provisional' and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.create_booking(uuid, date, date, public.booking_kind, public.booking_status, integer, text, text, text, text),
  public.create_booking_for_category(uuid, date, date, integer, text, text, text, public.booking_status, text),
  public.expire_provisional_bookings() from public, anon, authenticated;
grant execute on function public.create_booking(uuid, date, date, public.booking_kind, public.booking_status, integer, text, text, text, text),
  public.create_booking_for_category(uuid, date, date, integer, text, text, text, public.booking_status, text)
  to authenticated;
grant execute on function public.expire_provisional_bookings() to service_role;

select cron.schedule('expire-provisional-bookings', '*/5 * * * *', 'select public.expire_provisional_bookings()');

-- ---------------------------------------------------------------- triggers
create trigger bookings_guard before insert or update on public.bookings
  for each row execute function private.bookings_guard();
create trigger bookings_touch before update on public.bookings
  for each row execute function private.touch_updated_at();
create trigger bookings_audit after insert or update or delete on public.bookings
  for each row execute function private.audit_row();

-- ---------------------------------------------------------------- privileges and RLS
-- No DELETE: bookings are cancelled, never erased.
revoke all on public.guests, public.bookings from anon, authenticated;
grant select, insert, update on public.guests, public.bookings to authenticated;

alter table public.guests enable row level security;
alter table public.bookings enable row level security;

create policy guests_select on public.guests for select to authenticated
  using (org_id in (select private.user_org_ids()) or private.is_platform_admin());
create policy guests_insert on public.guests for insert to authenticated
  with check (private.can_operate_org(org_id));
create policy guests_update on public.guests for update to authenticated
  using (private.can_operate_org(org_id)) with check (private.can_operate_org(org_id));

create policy bookings_select on public.bookings for select to authenticated
  using (org_id in (select private.user_org_ids()) or private.is_platform_admin());
create policy bookings_insert on public.bookings for insert to authenticated
  with check (private.can_operate_org(org_id));
create policy bookings_update on public.bookings for update to authenticated
  using (private.can_operate_org(org_id)) with check (private.can_operate_org(org_id));
