-- Management features for owners and the platform admin (odd/tasks/gestion-propietario-superadmin.md):
-- * organizations: edit (owner: name; platform admin: name and address) and deactivation by the
--   platform admin (disabled_at), which org_is_active() honors, so the panel turns read-only and the
--   public page "no disponible" exactly as with a lapsed subscription;
-- * subscriptions: cancel (owner or platform admin) and reactivate until a date (platform admin);
-- * platform admins: add by email, remove (never oneself), list; changes are audited;
-- * holidays: an organization may load its own (owner/admin), next to the national ones;
-- * audit log: audit_entries() for the owner (own organization) and the platform admin (all), and
--   log_admin_access() records each time the platform admin opens an organization's bookings or guests.
-- Additive and forward-only. Rollback: restore the previous org_is_active, audit_row and holidays
-- policies; drop the new functions; delete organization holidays, drop holidays.org_id/id and restore
-- the primary key on date; drop organizations.disabled_at/disabled_by.

-- ---------------------------------------------------------------- organizations
alter table public.organizations
  add column disabled_at timestamptz,
  add column disabled_by uuid references auth.users (id) on delete set null;

create or replace function private.org_is_active(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.organizations o
      join public.subscriptions s on s.org_id = o.id
     where o.id = p_org
       and o.status = 'active'
       and o.disabled_at is null
       and s.status in ('trial', 'active', 'past_due')
       and private.today_ar() < s.current_period_end + s.grace_days
  );
$$;

-- Owner: the name of an active organization (the address is the public link, so only the platform
-- admin changes it). Platform admin: name and address, at any time.
create function public.update_organization(p_org uuid, p_name text, p_slug text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_admin boolean := private.is_platform_admin();
begin
  if not v_admin and not (
       private.has_org_role(p_org, array['owner']::public.member_role[])
       and private.org_is_active(p_org)
       and p_slug is null
     ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.organizations
     set name = trim(p_name),
         slug = coalesce(lower(trim(p_slug)), slug)
   where id = p_org;
  if not found then
    raise exception 'organization not found' using errcode = 'P0002';
  end if;
end;
$$;

create function public.set_organization_disabled(p_org uuid, p_disabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;
  update public.organizations
     set disabled_at = case when p_disabled then coalesce(disabled_at, now()) end,
         disabled_by = case when p_disabled then coalesce(disabled_by, (select auth.uid())) end
   where id = p_org;
  if not found then
    raise exception 'organization not found' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------- subscriptions
-- The owner or the platform admin ends a live subscription. Data is kept; the account turns
-- read-only and only the platform admin brings it back (payment or reactivation).
create function public.cancel_subscription(p_org uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (private.is_platform_admin() or private.has_org_role(p_org, array['owner']::public.member_role[])) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.subscriptions set status = 'cancelled'
   where org_id = p_org and status in ('trial', 'active', 'past_due');
  if not found then
    raise exception 'subscription not found or not live' using errcode = 'P0002';
  end if;
end;
$$;

-- Reactivation without a payment: the platform admin chooses until when (exclusive) the account is
-- active. The commercial reason (courtesy, payment outside the system) is theirs to record.
create function public.reactivate_subscription(p_org uuid, p_until date)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_today date := private.today_ar();
begin
  if not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;
  if p_until is null or p_until <= v_today or p_until > v_today + 731 then
    raise exception 'until must be a future date within two years' using errcode = '22023';
  end if;
  update public.subscriptions
     set status = 'active', current_period_start = v_today, current_period_end = p_until
   where org_id = p_org;
  if not found then
    raise exception 'subscription not found' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------- platform admins
-- The audit log keys platform_admins rows by user id (they have no id or org_id).
create or replace function private.audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit_log (org_id, actor_id, action, table_name, record_id, diff)
  values (
    case tg_table_name when 'organizations' then (v_row ->> 'id')::uuid else (v_row ->> 'org_id')::uuid end,
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    coalesce(v_row ->> 'id', (v_row ->> 'org_id') || ':' || (v_row ->> 'user_id'), v_row ->> 'user_id'),
    case tg_op
      when 'INSERT' then jsonb_build_object('new', to_jsonb(new))
      when 'UPDATE' then jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
      else jsonb_build_object('old', to_jsonb(old))
    end
  );
  return coalesce(new, old);
end;
$$;

create trigger platform_admins_audit after insert or delete on public.platform_admins
  for each row execute function private.audit_row();

create function public.grant_platform_admin(p_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
begin
  if not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if not found then
    raise exception 'user not found' using errcode = 'P0002';
  end if;
  insert into public.platform_admins (user_id) values (v_user) on conflict (user_id) do nothing;
  return v_user;
end;
$$;

create function public.revoke_platform_admin(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;
  -- Nobody locks themselves out, so there is always at least one platform admin left.
  if p_user = (select auth.uid()) then
    raise exception 'cannot remove yourself' using errcode = 'P0001';
  end if;
  delete from public.platform_admins where user_id = p_user;
  if not found then
    raise exception 'platform admin not found' using errcode = 'P0002';
  end if;
end;
$$;

create function public.list_platform_admins()
returns table (user_id uuid, email text, full_name text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;
  return query
    select a.user_id, u.email::text, coalesce(p.full_name, ''), a.created_at
      from public.platform_admins a
      join auth.users u on u.id = a.user_id
      left join public.profiles p on p.user_id = a.user_id
     order by a.created_at;
end;
$$;

-- ---------------------------------------------------------------- holidays
-- National holidays (org_id null, platform admin) and an organization's own (owner/admin). The
-- same date may appear once nationally and once per organization.
alter table public.holidays drop constraint holidays_pkey;
alter table public.holidays
  add column id uuid not null default gen_random_uuid() primary key,
  add column org_id uuid references public.organizations (id) on delete cascade;
alter table public.holidays add constraint holidays_org_id_date_key unique nulls not distinct (org_id, date);

drop policy holidays_select on public.holidays;
drop policy holidays_insert on public.holidays;
drop policy holidays_update on public.holidays;
drop policy holidays_delete on public.holidays;
drop policy holidays_select_public on public.holidays;

create policy holidays_select on public.holidays for select to authenticated
  using (org_id is null or org_id in (select private.user_org_ids()) or private.is_platform_admin());
-- Anonymous visitors price stays only on published properties of active organizations.
create policy holidays_select_public on public.holidays for select to anon
  using (
    org_id is null
    or exists (select 1 from public.properties p where p.org_id = holidays.org_id and private.property_is_public(p.id))
  );
create policy holidays_insert on public.holidays for insert to authenticated
  with check (case when org_id is null then private.is_platform_admin() else private.can_manage_org(org_id) end);
create policy holidays_update on public.holidays for update to authenticated
  using (case when org_id is null then private.is_platform_admin() else private.can_manage_org(org_id) end)
  with check (case when org_id is null then private.is_platform_admin() else private.can_manage_org(org_id) end);
create policy holidays_delete on public.holidays for delete to authenticated
  using (case when org_id is null then private.is_platform_admin() else private.can_manage_org(org_id) end);

-- Whose holiday it is never changes after it is created.
revoke all on public.holidays from authenticated;
grant select, delete on public.holidays to authenticated;
grant insert (org_id, date, name) on public.holidays to authenticated;
grant update (date, name) on public.holidays to authenticated;

-- ---------------------------------------------------------------- audit log
-- One organization's log (its owner or the platform admin) or every organization's (platform admin
-- only), newest first, paged by id. The actor is shown by name; to an owner, someone outside their
-- team (the platform admin) shows as null and the page labels it "Plataforma".
create function public.audit_entries(p_org uuid default null, p_before bigint default null, p_limit integer default 50)
returns table (
  id bigint, org_id uuid, org_name text, actor_id uuid, actor text, action text, table_name text,
  record_id text, diff jsonb, at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_admin boolean := private.is_platform_admin();
begin
  if not v_admin and (p_org is null or not private.has_org_role(p_org, array['owner']::public.member_role[])) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select l.id, l.org_id, o.name, l.actor_id,
           case
             when l.actor_id is null then null
             when v_admin or exists (select 1 from public.memberships m where m.org_id = l.org_id and m.user_id = l.actor_id)
               then coalesce(nullif(p.full_name, ''), u.email::text)
           end,
           l.action, l.table_name, l.record_id, l.diff, l.at
      from public.audit_log l
      left join public.organizations o on o.id = l.org_id
      left join public.profiles p on p.user_id = l.actor_id
      left join auth.users u on u.id = l.actor_id
     where (p_org is null or l.org_id = p_org)
       and (p_before is null or l.id < p_before)
     order by l.id desc
     limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

-- Reading an organization's bookings or guests is an operation of the platform admin: audited.
create function public.log_admin_access(p_org uuid, p_area text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;
  if p_area not in ('bookings', 'guests') then
    raise exception 'invalid area' using errcode = '22023';
  end if;
  insert into public.audit_log (org_id, actor_id, action, table_name, record_id, diff)
  values (p_org, (select auth.uid()), 'view', p_area, null, null);
end;
$$;

-- ---------------------------------------------------------------- grants
revoke execute on function public.update_organization(uuid, text, text),
  public.set_organization_disabled(uuid, boolean),
  public.cancel_subscription(uuid),
  public.reactivate_subscription(uuid, date),
  public.grant_platform_admin(text),
  public.revoke_platform_admin(uuid),
  public.list_platform_admins(),
  public.audit_entries(uuid, bigint, integer),
  public.log_admin_access(uuid, text)
  from public, anon;
grant execute on function public.update_organization(uuid, text, text),
  public.set_organization_disabled(uuid, boolean),
  public.cancel_subscription(uuid),
  public.reactivate_subscription(uuid, date),
  public.grant_platform_admin(text),
  public.revoke_platform_admin(uuid),
  public.list_platform_admins(),
  public.audit_entries(uuid, bigint, integer),
  public.log_admin_access(uuid, text)
  to authenticated;
