-- Code review fixes for the management feature (odd/tasks/gestion-propietario-superadmin.md).
--
-- 1. revoke_platform_admin: two admins removing each other at the same time could leave none.
--    The removal now locks platform_admins, re-checks the caller and refuses to remove the last one.
-- 2. audit_entries: owners no longer receive platform admin ids (actor_id, or approved_by,
--    disabled_by and recorded_by inside the diffs); former team members keep their name instead of
--    reading as "Plataforma"; a new actor_kind column ('member' | 'platform' | 'system') says who
--    acted. The return type changes, so the function is dropped and created again.
-- 3. audit_log gets an (org_id, id desc) index: audit_entries pages by id within an organization.
--
-- Additive in behavior. Rollback: restore both functions from 20261102165721_management.sql and
-- drop index audit_log_org_id_id_idx.

create or replace function public.revoke_platform_admin(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;
  if p_user = (select auth.uid()) then
    raise exception 'cannot remove yourself' using errcode = 'P0001';
  end if;
  -- Serializes removals. A caller that another admin removed while it waited is refused here.
  lock table public.platform_admins in share row exclusive mode;
  if not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.platform_admins where user_id <> p_user) then
    raise exception 'cannot remove the last platform admin' using errcode = 'P0003';
  end if;
  delete from public.platform_admins where user_id = p_user;
  if not found then
    raise exception 'platform admin not found' using errcode = 'P0002';
  end if;
end;
$$;

drop function public.audit_entries(uuid, bigint, integer);

create function public.audit_entries(p_org uuid default null, p_before bigint default null, p_limit integer default 50)
returns table (
  id bigint, org_id uuid, org_name text, actor_id uuid, actor text, actor_kind text, action text,
  table_name text, record_id text, diff jsonb, at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_admin boolean := private.is_platform_admin();
  -- For an owner: everyone who is or was on the team (removals stay in the memberships audit rows).
  v_team uuid[];
begin
  if not v_admin and (p_org is null or not private.has_org_role(p_org, array['owner']::public.member_role[])) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not v_admin then
    select coalesce(array_agg(distinct t.user_id), '{}') into v_team
      from (
        select m.user_id from public.memberships m where m.org_id = p_org
        union
        select (a.diff -> side ->> 'user_id')::uuid
          from public.audit_log a, unnest(array['old', 'new']) side
         where a.org_id = p_org and a.table_name = 'memberships' and a.diff -> side ->> 'user_id' is not null
      ) t;
  end if;
  return query
    select l.id, l.org_id, o.name,
           case when v_admin or l.actor_id = any(v_team) then l.actor_id end,
           case when l.actor_id is not null and (v_admin or l.actor_id = any(v_team))
                then coalesce(nullif(p.full_name, ''), u.email::text) end,
           case
             when l.actor_id is null then 'system'
             when v_admin then
               case when exists (select 1 from public.platform_admins pa where pa.user_id = l.actor_id)
                     and not exists (select 1 from public.memberships m where m.org_id = l.org_id and m.user_id = l.actor_id)
                    then 'platform' else 'member' end
             when l.actor_id = any(v_team) then 'member'
             else 'platform'
           end,
           l.action, l.table_name, l.record_id,
           case
             when v_admin then l.diff
             when l.table_name = 'organizations'
               then l.diff #- '{old,approved_by}' #- '{new,approved_by}' #- '{old,disabled_by}' #- '{new,disabled_by}'
             when l.table_name = 'subscription_payments'
               then l.diff #- '{old,recorded_by}' #- '{new,recorded_by}'
             else l.diff
           end,
           l.at
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

revoke execute on function public.audit_entries(uuid, bigint, integer) from public, anon;
grant execute on function public.audit_entries(uuid, bigint, integer) to authenticated;

create index audit_log_org_id_id_idx on public.audit_log (org_id, id desc);
