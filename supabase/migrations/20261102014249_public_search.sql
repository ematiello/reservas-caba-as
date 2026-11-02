-- Phase 6, search (D26): visitors find published properties by place or name and, given dates,
-- only those with a free unit for their guests. Same exposure as the public page: published
-- properties of active accounts, unit counts and dates only, never bookings or guests (invariant 7).
-- Also reserves "buscar" (the /buscar route) for property and organization slugs.
-- Forward-only; rollback = drop public_search, restore the two CHECK constraints without 'buscar'.
-- unaccent stays installed (harmless).

create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------- reserved slug
alter table public.properties drop constraint properties_slug_check1;
alter table public.properties add constraint properties_slug_check1
  check (slug not in ('admin', 'panel', 'api', 'auth', 'login', 'registro', 'logout', 'invitacion', 'precios',
                      'static', 'buscar'));
alter table public.organizations drop constraint organizations_slug_check1;
alter table public.organizations add constraint organizations_slug_check1
  check (slug not in ('admin', 'panel', 'api', 'auth', 'login', 'registro', 'logout', 'invitacion', 'precios',
                      'static', 'buscar'));

-- ---------------------------------------------------------------- search
-- p_query: every word must appear in the name, city or province (case and accents ignored).
-- p_check_in / p_check_out: both or neither; with them a unit counts only when no blocking stay
-- overlaps [check-in, check-out + cleaning days), like the exclusion constraint.
-- p_guests: units must hold that many. free_units = matching published units; when dates or guests
-- were asked for, properties without one are left out.
create function public.public_search(
  p_query text default null,
  p_check_in date default null,
  p_check_out date default null,
  p_guests integer default null
)
returns table (slug text, name text, city text, province text, free_units integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_words text[];
  v_needs_unit boolean := p_check_in is not null or p_guests is not null;
begin
  if char_length(coalesce(p_query, '')) > 80 then
    raise exception 'invalid_query' using errcode = '22023';
  end if;
  if (p_check_in is null) <> (p_check_out is null)
     or p_check_out <= p_check_in
     or p_check_out - p_check_in > 365 then
    raise exception 'invalid_stay' using errcode = '22023';
  end if;
  if p_guests is not null and (p_guests < 1 or p_guests > 50) then
    raise exception 'invalid_guests' using errcode = '22023';
  end if;

  v_words := array_remove(regexp_split_to_array(lower(extensions.unaccent(trim(coalesce(p_query, '')))), '\s+'), '');

  return query
    select r.slug, r.name, r.city, r.province, r.free_units
      from (
        select p.slug, p.name, p.city, p.province,
               (select count(*)::integer
                  from public.units u
                 where u.property_id = p.id
                   and u.is_published
                   and u.max_guests >= coalesce(p_guests, 1)
                   and (p_check_in is null or not exists (
                     select 1 from public.bookings b
                      where b.unit_id = u.id
                        and b.occupied && daterange(p_check_in, p_check_out + p.cleaning_buffer_days, '[)')
                        and (b.status in ('confirmed', 'checked_in', 'checked_out')
                             or (b.status = 'provisional' and b.expires_at > now()))))) as free_units
          from public.properties p
         where p.is_published
           and private.org_is_active(p.org_id)
           and not exists (
             select 1 from unnest(v_words) w
              where strpos(lower(extensions.unaccent(p.name || ' ' || coalesce(p.city, '') || ' ' || coalesce(p.province, ''))), w) = 0)
      ) r
     where r.free_units > 0 or not v_needs_unit
     order by r.name
     limit 100;
end;
$$;

revoke execute on function public.public_search(text, date, date, integer) from public;
grant execute on function public.public_search(text, date, date, integer) to anon, authenticated;
