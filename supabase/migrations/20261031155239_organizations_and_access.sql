-- Phase 1: organizations and access.
-- Platform admins, profiles, organizations, memberships, invitations, audit log,
-- control functions (private schema) and RLS. Forward-only; rollback = drop objects in reverse order.

-- ---------------------------------------------------------------- types
create type public.org_status as enum ('pending_approval', 'active', 'rejected');
create type public.member_role as enum ('owner', 'admin', 'operator');

-- ---------------------------------------------------------------- tables
create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  phone text check (phone is null or char_length(phone) <= 40),
  created_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  -- Public pages live at /{slug}: reserved words would collide with app routes.
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 40)
    check (slug not in ('admin', 'panel', 'api', 'auth', 'login', 'registro', 'logout', 'invitacion', 'precios', 'static')),
  status public.org_status not null default 'pending_approval',
  approved_at timestamptz,
  approved_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.memberships (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index memberships_user_id_idx on public.memberships (user_id);

-- Invitation links (D21): only the sha256 hex of the token is stored.
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  role public.member_role not null check (role <> 'owner'),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null default now() + interval '7 days',
  created_by uuid not null references auth.users (id),
  accepted_by uuid references auth.users (id),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index invitations_org_id_idx on public.invitations (org_id);

create table public.audit_log (
  id bigint generated always as identity primary key,
  org_id uuid,
  actor_id uuid,
  action text not null,
  table_name text not null,
  record_id text,
  diff jsonb,
  at timestamptz not null default now()
);
create index audit_log_org_id_at_idx on public.audit_log (org_id, at desc);

-- ---------------------------------------------------------------- control functions
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create function private.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;

create function private.user_org_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select org_id from public.memberships where user_id = (select auth.uid());
$$;

create function private.has_org_role(p_org uuid, p_roles public.member_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships
    where org_id = p_org and user_id = (select auth.uid()) and role = any (p_roles)
  );
$$;

-- Phase 1: active = organization approved. The subscription is added in Phase 2.
create function private.org_is_active(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organizations where id = p_org and status = 'active');
$$;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- ---------------------------------------------------------------- audit triggers
create function private.audit_row()
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
    coalesce(v_row ->> 'id', (v_row ->> 'org_id') || ':' || (v_row ->> 'user_id')),
    case tg_op
      when 'INSERT' then jsonb_build_object('new', to_jsonb(new))
      when 'UPDATE' then jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
      else jsonb_build_object('old', to_jsonb(old))
    end
  );
  return coalesce(new, old);
end;
$$;

create trigger organizations_audit after insert or update or delete on public.organizations
  for each row execute function private.audit_row();
create trigger memberships_audit after insert or update or delete on public.memberships
  for each row execute function private.audit_row();
create trigger invitations_audit after insert or update on public.invitations
  for each row execute function private.audit_row();

-- ---------------------------------------------------------------- profile on signup
create function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------- RPCs (called from the app)
-- Registration: creates the organization as pending_approval and makes the caller its owner.
create function public.register_organization(p_name text, p_slug text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  insert into public.organizations (name, slug) values (trim(p_name), lower(trim(p_slug)))
  returning id into v_org;
  insert into public.memberships (org_id, user_id, role) values (v_org, (select auth.uid()), 'owner');
  return v_org;
end;
$$;

-- Superadmin review: pending_approval -> active | rejected.
create function public.review_organization(p_org uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;
  update public.organizations
     set status = case when p_approve then 'active'::public.org_status else 'rejected'::public.org_status end,
         approved_at = case when p_approve then now() end,
         approved_by = case when p_approve then (select auth.uid()) end
   where id = p_org and status = 'pending_approval';
  if not found then
    raise exception 'organization not found or not pending' using errcode = 'P0002';
  end if;
end;
$$;

-- Accepts an invitation link. The token is hashed here; single use, expiring, org must be active.
create function public.accept_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_inv public.invitations;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  select * into v_inv from public.invitations
   where token_hash = encode(sha256(convert_to(p_token, 'utf8')), 'hex')
     and accepted_at is null and revoked_at is null and expires_at > now()
   for update;
  if not found or not private.org_is_active(v_inv.org_id) then
    raise exception 'invalid or expired invitation' using errcode = 'P0002';
  end if;
  -- Never downgrade an existing member.
  insert into public.memberships (org_id, user_id, role)
  values (v_inv.org_id, (select auth.uid()), v_inv.role)
  on conflict (org_id, user_id) do nothing;
  update public.invitations set accepted_by = (select auth.uid()), accepted_at = now() where id = v_inv.id;
  return v_inv.org_id;
end;
$$;

revoke execute on function public.register_organization(text, text) from public, anon;
revoke execute on function public.review_organization(uuid, boolean) from public, anon;
revoke execute on function public.accept_invitation(text) from public, anon;
grant execute on function public.register_organization(text, text) to authenticated;
grant execute on function public.review_organization(uuid, boolean) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;

-- ---------------------------------------------------------------- privileges
revoke all on public.platform_admins, public.profiles, public.organizations,
  public.memberships, public.invitations, public.audit_log from anon, authenticated;

grant select on public.platform_admins, public.organizations, public.audit_log to authenticated;
grant select, update (full_name, phone) on public.profiles to authenticated;
grant select, delete on public.memberships to authenticated;
grant update (role) on public.memberships to authenticated;
grant select, insert on public.invitations to authenticated;
grant update (revoked_at) on public.invitations to authenticated;

-- ---------------------------------------------------------------- RLS
alter table public.platform_admins enable row level security;
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.audit_log enable row level security;

create policy platform_admins_select on public.platform_admins
  for select to authenticated using (user_id = (select auth.uid()));

create policy profiles_select on public.profiles
  for select to authenticated using (
    user_id = (select auth.uid())
    or private.is_platform_admin()
    or user_id in (
      select m.user_id from public.memberships m where m.org_id in (select private.user_org_ids())
    )
  );
create policy profiles_update_own on public.profiles
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy organizations_select on public.organizations
  for select to authenticated using (id in (select private.user_org_ids()) or private.is_platform_admin());

create policy memberships_select on public.memberships
  for select to authenticated using (org_id in (select private.user_org_ids()) or private.is_platform_admin());
-- Only the owner manages collaborators, never an owner row, and never on a non-active org.
create policy memberships_update on public.memberships
  for update to authenticated
  using (private.has_org_role(org_id, array['owner']::public.member_role[]) and role <> 'owner' and private.org_is_active(org_id))
  with check (role in ('admin', 'operator'));
create policy memberships_delete on public.memberships
  for delete to authenticated
  using (private.has_org_role(org_id, array['owner']::public.member_role[]) and role <> 'owner' and private.org_is_active(org_id));

create policy invitations_select on public.invitations
  for select to authenticated using (
    private.has_org_role(org_id, array['owner']::public.member_role[]) or private.is_platform_admin()
  );
create policy invitations_insert on public.invitations
  for insert to authenticated with check (
    private.has_org_role(org_id, array['owner']::public.member_role[])
    and private.org_is_active(org_id)
    and created_by = (select auth.uid())
  );
create policy invitations_revoke on public.invitations
  for update to authenticated
  using (private.has_org_role(org_id, array['owner']::public.member_role[]) and accepted_at is null)
  with check (private.has_org_role(org_id, array['owner']::public.member_role[]));

create policy audit_log_select on public.audit_log
  for select to authenticated using (
    private.is_platform_admin()
    or (org_id is not null and private.has_org_role(org_id, array['owner']::public.member_role[]))
  );
-- audit_log: no write policies and no write grants; only the audit triggers insert.
