-- Judgment Day follow-up to P15: pg_timezone_names also lists entries that are not IANA zones
-- (Factory, posixrules, localtime, posix/..., right/...), and Intl.DateTimeFormat rejects them,
-- which would break the panel and the public page. Only "UTC" or an Area/Location name is accepted.
-- Rollback: re-run private.check_property_timezone from 20261103111439_property_timezone_check.sql.

create or replace function private.check_property_timezone()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not (
       new.timezone = 'UTC'
    or (new.timezone ~ '^[A-Z][A-Za-z_-]*(/[A-Za-z0-9_+-]+)+$'
        and new.timezone !~ '^(posix|right)/'
        and exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone))
  ) then
    raise exception 'invalid_timezone' using errcode = 'RT002';
  end if;
  return new;
end;
$$;
