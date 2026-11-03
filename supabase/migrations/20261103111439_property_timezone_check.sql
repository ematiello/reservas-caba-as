-- P15 (docs/06-pendientes-tecnicos.md): properties.timezone must be an IANA zone. Dates in the
-- panel and the public page are formatted with it, so a bad value would break those pages.
-- A trigger instead of a CHECK because the list lives in pg_timezone_names (a view).
-- Rollback: drop trigger properties_check_timezone; drop function private.check_property_timezone.

create function private.check_property_timezone()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'invalid_timezone' using errcode = 'RT002';
  end if;
  return new;
end;
$$;

revoke execute on function private.check_property_timezone() from public, anon, authenticated;

create trigger properties_check_timezone
  before insert or update of timezone on public.properties
  for each row execute function private.check_property_timezone();
