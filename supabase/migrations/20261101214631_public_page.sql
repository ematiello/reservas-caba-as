-- Phase 6: what the public page of an establishment reads as an anonymous visitor.
-- * public_property_state(slug): "published", "unavailable" (published, account suspended) or "missing".
-- * public_availability(slug, from, to): occupied ranges of published units, no personal data (invariant 7).
-- * anon reads list prices (rates, length discounts, holidays), categories and unit amenities of
--   published properties of active organizations, to price a stay on the server and show the units.
-- Forward-only; rollback = drop the two functions and the *_select_public policies, revoke the grants.

-- ---------------------------------------------------------------- page state
create function public.public_property_state(p_slug text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select case when private.org_is_active(p.org_id) then 'published' else 'unavailable' end
       from public.properties p
      where p.slug = p_slug and p.is_published),
    'missing');
$$;

-- ---------------------------------------------------------------- availability
-- Occupied ranges (stay plus cleaning days, as the exclusion constraint sees them) that overlap
-- [p_from, p_to). Only unit id and dates: never the booking, its status or its guest.
create function public.public_availability(p_slug text, p_from date, p_to date)
returns table (unit_id uuid, starts_on date, ends_on date)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_from is null or p_to is null or p_to <= p_from or p_to - p_from > 731 then
    raise exception 'invalid_window' using errcode = '22023';
  end if;

  return query
    select b.unit_id, lower(b.occupied), upper(b.occupied)
      from public.properties p
      join public.units u on u.property_id = p.id and u.is_published
      join public.bookings b on b.unit_id = u.id
     where p.slug = p_slug
       and p.is_published
       and private.org_is_active(p.org_id)
       and b.occupied && daterange(p_from, p_to, '[)')
       and (b.status in ('confirmed', 'checked_in', 'checked_out')
            or (b.status = 'provisional' and b.expires_at > now()))
     order by b.unit_id, lower(b.occupied);
end;
$$;

revoke execute on function public.public_property_state(text), public.public_availability(text, date, date)
  from public;
grant execute on function public.public_property_state(text), public.public_availability(text, date, date)
  to anon, authenticated;

-- ---------------------------------------------------------------- list prices and unit details
grant select on public.rate_rules, public.length_discounts, public.holidays, public.unit_categories,
  public.unit_amenities to anon;

create policy holidays_select_public on public.holidays for select to anon using (true);
create policy rate_rules_select_public on public.rate_rules for select to anon
  using (private.property_is_public(property_id));
create policy length_discounts_select_public on public.length_discounts for select to anon
  using (private.property_is_public(property_id));
create policy unit_categories_select_public on public.unit_categories for select to anon
  using (private.property_is_public(property_id));
create policy unit_amenities_select_public on public.unit_amenities for select to anon
  using (exists (
    select 1 from public.units u
     where u.id = unit_amenities.unit_id and u.is_published and private.property_is_public(u.property_id)));
