-- Error log for the platform admin (odd/tasks/panel-errores-y-limpieza-dev.md, S1).
--
-- Errors are grouped by a fingerprint (source, route, normalized message). A repeat increments
-- `count` and `last_at` instead of adding a row, so a flood cannot fill the table, and a resolved
-- error that happens again reopens. Only the server writes (log_error, service_role): no user has
-- an insert, update or delete policy. Only the platform admin reads and changes the status.
--
-- Additive. Rollback: select cron.unschedule('purge-error-log'); drop function public.set_error_status,
-- public.log_error; drop table public.error_log.

create table public.error_log (
  id bigint generated always as identity primary key,
  fingerprint text not null unique,
  source text not null check (source in ('server', 'browser')),
  severity text not null default 'error' check (severity in ('error', 'warning')),
  message text not null,
  detail text,
  route text,
  digest text,
  org_id uuid references public.organizations (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  count integer not null default 1,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'resolved', 'ignored')),
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz
);

create index error_log_status_last_idx on public.error_log (status, last_at desc);
create index error_log_last_idx on public.error_log (last_at desc);

alter table public.error_log enable row level security;

create policy error_log_select on public.error_log for select to authenticated
  using ((select private.is_platform_admin()));

revoke all on public.error_log from anon, authenticated;
grant select on public.error_log to authenticated;

-- Called by the server with the secret key only. Lengths are capped here too, so a caller that
-- skipped the sanitizer in the app cannot store an unbounded value.
create function public.log_error(
  p_fingerprint text,
  p_source text,
  p_severity text,
  p_message text,
  p_detail text default null,
  p_route text default null,
  p_digest text default null,
  p_org uuid default null,
  p_user uuid default null
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.error_log (fingerprint, source, severity, message, detail, route, digest, org_id, user_id)
  values (
    left(p_fingerprint, 128), p_source, p_severity, left(p_message, 500), left(p_detail, 4000),
    left(p_route, 200), left(p_digest, 100), p_org, p_user
  )
  on conflict (fingerprint) do update
     set count = public.error_log.count + 1,
         last_at = now(),
         detail = coalesce(excluded.detail, public.error_log.detail),
         digest = coalesce(excluded.digest, public.error_log.digest),
         org_id = coalesce(excluded.org_id, public.error_log.org_id),
         user_id = coalesce(excluded.user_id, public.error_log.user_id),
         status = case when public.error_log.status = 'resolved' then 'open' else public.error_log.status end,
         resolved_by = case when public.error_log.status = 'resolved' then null else public.error_log.resolved_by end,
         resolved_at = case when public.error_log.status = 'resolved' then null else public.error_log.resolved_at end;
end;
$$;

revoke execute on function public.log_error(text, text, text, text, text, text, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.log_error(text, text, text, text, text, text, text, uuid, uuid) to service_role;

-- The platform admin triages: open, resolved or ignored. The change is written to the audit log
-- with no organization, so owners never see it in their activity.
create function public.set_error_status(p_id bigint, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_old text;
begin
  if not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;
  if p_status not in ('open', 'resolved', 'ignored') then
    raise exception 'invalid status' using errcode = '22023';
  end if;
  select status into v_old from public.error_log where id = p_id for update;
  if not found then
    raise exception 'error not found' using errcode = 'P0002';
  end if;
  update public.error_log
     set status = p_status,
         resolved_by = case when p_status = 'open' then null else (select auth.uid()) end,
         resolved_at = case when p_status = 'open' then null else now() end
   where id = p_id;
  insert into public.audit_log (org_id, actor_id, action, table_name, record_id, diff)
  values (null, (select auth.uid()), 'update', 'error_log', p_id::text,
          jsonb_build_object('old', jsonb_build_object('status', v_old), 'new', jsonb_build_object('status', p_status)));
end;
$$;

revoke execute on function public.set_error_status(bigint, text) from public, anon;
grant execute on function public.set_error_status(bigint, text) to authenticated;

-- Retention: resolved or ignored errors after 90 days, any error after 180. Sundays, 03:30 in
-- Argentina (06:30 UTC).
create function public.purge_error_log()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  delete from public.error_log
   where (status <> 'open' and last_at < now() - interval '90 days')
      or last_at < now() - interval '180 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.purge_error_log() from public, anon, authenticated;
select cron.schedule('purge-error-log', '30 6 * * 0', $$select public.purge_error_log()$$);
grant execute on function public.purge_error_log() to service_role;
