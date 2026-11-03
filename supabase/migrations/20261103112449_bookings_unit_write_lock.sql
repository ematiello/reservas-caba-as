-- P26 (docs/06-pendientes-tecnicos.md): concurrent conflicting bookings for one unit could end in a
-- deadlock instead of the overlap error. bookings_guard now takes a transaction-scoped advisory lock
-- per unit whenever a booking is inserted or moved. Only the lock line changes.
-- Rollback: re-run private.bookings_guard from 20261103111035_review_followups_sort_unit_cap_hold.sql.

create or replace function private.bookings_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_unit record;
  v_moved boolean;
  v_session boolean := (select auth.uid()) is not null;
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
    if v_session then
      new.total_cents := null;
      new.deposit_cents := null;
      new.price_breakdown := null;
      new.currency := 'ARS';
    end if;
    new.created_by := (select auth.uid());
    new.created_at := now();
    new.updated_at := now();
    v_moved := true;
  else
    if new.org_id is distinct from old.org_id or new.property_id is distinct from old.property_id
       or new.kind is distinct from old.kind or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at
       or new.cleaning_buffer_days is distinct from old.cleaning_buffer_days
       or (v_session and (
             new.total_cents is distinct from old.total_cents
          or new.deposit_cents is distinct from old.deposit_cents
          or new.price_breakdown is distinct from old.price_breakdown
          or new.currency is distinct from old.currency)) then
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
      elsif new.expires_at is distinct from old.expires_at and v_session then
        raise exception 'immutable_field' using errcode = 'P0001';
      end if;
    elsif new.expires_at is distinct from old.expires_at and v_session then
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
    -- Serialize writes per unit before the row reaches the exclusion index: two conflicting
    -- inserts otherwise wait on each other's uncommitted index entry and one gets a deadlock
    -- (40P01) instead of the overlap error (23P01).
    perform pg_advisory_xact_lock(hashtextextended('booking_unit:' || new.unit_id::text, 0));
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
