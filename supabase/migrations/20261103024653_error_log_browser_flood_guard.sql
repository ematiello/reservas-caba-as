-- Browser reports come from a public server action, so anyone can fabricate them. Grouping by
-- fingerprint already stops repeats from adding rows, but distinct fake messages could still fill the
-- table. Cap the NEW browser fingerprints at 100 per hour; known ones keep counting.
create or replace function public.log_error(
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
  if p_source = 'browser'
     and not exists (select 1 from public.error_log where fingerprint = left(p_fingerprint, 128))
     and (select count(*) from public.error_log
           where source = 'browser' and first_at > now() - interval '1 hour') >= 100 then
    return;
  end if;

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
