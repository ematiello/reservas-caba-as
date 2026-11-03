-- Phase 3: accommodations. Properties, unit categories, units, amenities, media (Storage) and the
-- plan's unit cap. Every child row carries org_id and a composite foreign key to its parent, so a
-- row can never point at another organization's property, unit or category.
-- Forward-only; rollback = drop the storage policies and bucket, then the objects in reverse order.

-- ---------------------------------------------------------------- types
create type public.unit_kind as enum ('cabin', 'house', 'apartment', 'room');

-- ---------------------------------------------------------------- tables
create table public.amenities (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]{2,40}$'),
  name text not null check (char_length(name) between 2 and 60)
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60)
    check (slug not in ('admin', 'panel', 'api', 'auth', 'login', 'registro', 'logout', 'invitacion', 'precios', 'static')),
  name text not null check (char_length(name) between 2 and 120),
  description text not null default '' check (char_length(description) <= 5000),
  address text check (address is null or char_length(address) <= 200),
  city text check (city is null or char_length(city) <= 100),
  province text check (province is null or char_length(province) <= 100),
  lat double precision check (lat is null or lat between -90 and 90),
  lng double precision check (lng is null or lng between -180 and 180),
  timezone text not null default 'America/Argentina/Buenos_Aires',
  -- International format without spaces, as wa.me expects it.
  whatsapp text check (whatsapp is null or whatsapp ~ '^[0-9]{8,15}$'),
  check_in_time time,
  check_out_time time,
  cleaning_buffer_days integer not null default 0 check (cleaning_buffer_days between 0 and 30),
  provisional_hold_hours integer not null default 12 check (provisional_hold_hours between 6 and 12),
  deposit_pct integer not null default 30 check (deposit_pct between 0 and 100),
  weekend_days integer[] not null default '{5,6}' check (weekend_days <@ '{0,1,2,3,4,5,6}'::integer[]),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((lat is null) = (lng is null)),
  unique (org_id, id)
);
create index properties_org_id_idx on public.properties (org_id);

create table public.unit_categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  property_id uuid not null,
  name text not null check (char_length(name) between 2 and 80),
  description text not null default '' check (char_length(description) <= 2000),
  created_at timestamptz not null default now(),
  foreign key (org_id, property_id) references public.properties (org_id, id) on delete cascade,
  unique (property_id, id)
);
create index unit_categories_org_property_idx on public.unit_categories (org_id, property_id);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  property_id uuid not null,
  category_id uuid,
  kind public.unit_kind not null,
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 5000),
  max_guests integer not null check (max_guests between 1 and 50),
  bedrooms integer check (bedrooms is null or bedrooms between 0 and 50),
  beds integer check (beds is null or beds between 0 and 100),
  sort integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (org_id, property_id) references public.properties (org_id, id) on delete cascade,
  -- The category must belong to the same property. Deleting it only clears category_id.
  foreign key (property_id, category_id) references public.unit_categories (property_id, id)
    on delete set null (category_id),
  unique (org_id, id),
  unique (property_id, id)
);
create index units_org_property_idx on public.units (org_id, property_id);
create index units_category_idx on public.units (property_id, category_id);

create table public.unit_amenities (
  org_id uuid not null,
  unit_id uuid not null,
  amenity_id uuid not null references public.amenities (id) on delete cascade,
  primary key (unit_id, amenity_id),
  foreign key (org_id, unit_id) references public.units (org_id, id) on delete cascade
);
create index unit_amenities_org_idx on public.unit_amenities (org_id);
create index unit_amenities_amenity_idx on public.unit_amenities (amenity_id);

create table public.media (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  property_id uuid not null,
  unit_id uuid,
  -- Object name inside the "media" bucket: {org_id}/{property_id}/{file}.
  storage_path text not null unique,
  alt text not null default '' check (char_length(alt) <= 200),
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  foreign key (org_id, property_id) references public.properties (org_id, id) on delete cascade,
  foreign key (property_id, unit_id) references public.units (property_id, id) on delete cascade,
  check (storage_path like org_id::text || '/' || property_id::text || '/%')
);
create index media_org_property_idx on public.media (org_id, property_id, sort);
create index media_unit_idx on public.media (property_id, unit_id);

insert into public.amenities (code, name) values
  ('wifi', 'Wi-Fi'),
  ('air_conditioning', 'Aire acondicionado'),
  ('heating', 'Calefacción'),
  ('fireplace', 'Hogar a leña'),
  ('kitchen', 'Cocina equipada'),
  ('grill', 'Parrilla'),
  ('pool', 'Pileta'),
  ('parking', 'Estacionamiento'),
  ('tv', 'TV'),
  ('linens', 'Ropa de cama'),
  ('towels', 'Toallas'),
  ('pets_allowed', 'Se admiten mascotas'),
  ('breakfast', 'Desayuno'),
  ('washing_machine', 'Lavarropas'),
  ('private_bathroom', 'Baño privado'),
  ('garden', 'Jardín');

-- ---------------------------------------------------------------- functions
-- Published property of an active organization: what anonymous visitors may read.
create function private.property_is_public(p_property uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.properties p
     where p.id = p_property and p.is_published and private.org_is_active(p.org_id)
  );
$$;

-- Owner or admin of an active organization: who may change accommodations.
create function private.can_manage_org(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_org_role(p_org, array['owner', 'admin']::public.member_role[])
     and private.org_is_active(p_org);
$$;

create function private.try_uuid(p_text text)
returns uuid language plpgsql immutable set search_path = '' as $$
begin
  return p_text::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

-- Storage write check: the path is {org_id}/{property_id}/{file}, the property belongs to that
-- organization, and the caller manages it.
create function private.can_manage_media_object(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.can_manage_org(o.org)
     and exists (select 1 from public.properties p where p.id = o.property and p.org_id = o.org)
    from (
      select private.try_uuid(split_part(p_name, '/', 1)) as org,
             private.try_uuid(split_part(p_name, '/', 2)) as property
    ) o
   where o.org is not null and o.property is not null
     and split_part(p_name, '/', 3) <> '' and split_part(p_name, '/', 4) = '';
$$;

-- Plan cap on units, serialized per organization so concurrent inserts cannot overshoot it.
create function private.enforce_unit_cap()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_max integer;
begin
  perform 1 from public.organizations where id = new.org_id for update;
  select p.max_units into v_max
    from public.subscriptions s join public.plans p on p.id = s.plan_id
   where s.org_id = new.org_id;
  if v_max is not null and (select count(*) from public.units where org_id = new.org_id) >= v_max then
    raise exception 'unit limit reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function private.property_is_public(uuid), private.can_manage_org(uuid),
  private.try_uuid(text), private.can_manage_media_object(text), private.enforce_unit_cap()
  from public, anon, authenticated;
-- Policies run these with the caller's role.
grant execute on function private.can_manage_org(uuid), private.can_manage_media_object(text),
  private.property_is_public(uuid) to authenticated;
grant usage on schema private to anon;
grant execute on function private.property_is_public(uuid) to anon;

-- ---------------------------------------------------------------- triggers
create trigger units_cap before insert on public.units
  for each row execute function private.enforce_unit_cap();
create trigger properties_touch before update on public.properties
  for each row execute function private.touch_updated_at();
create trigger units_touch before update on public.units
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------- privileges
revoke all on public.amenities, public.properties, public.unit_categories, public.units,
  public.unit_amenities, public.media from anon, authenticated;

grant select on public.amenities, public.properties, public.units, public.media to anon;
grant select on public.amenities to authenticated;
grant insert (code, name), update (name) on public.amenities to authenticated;
grant select, insert, update, delete on public.properties, public.unit_categories, public.units,
  public.unit_amenities, public.media to authenticated;

-- ---------------------------------------------------------------- RLS
alter table public.amenities enable row level security;
alter table public.properties enable row level security;
alter table public.unit_categories enable row level security;
alter table public.units enable row level security;
alter table public.unit_amenities enable row level security;
alter table public.media enable row level security;

create policy amenities_select on public.amenities for select to anon, authenticated using (true);
create policy amenities_insert on public.amenities for insert to authenticated with check (private.is_platform_admin());
create policy amenities_update on public.amenities for update to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());

-- properties
create policy properties_select_public on public.properties for select to anon
  using (is_published and private.property_is_public(id));
create policy properties_select on public.properties for select to authenticated
  using (org_id in (select private.user_org_ids()) or private.is_platform_admin() or private.property_is_public(id));
create policy properties_insert on public.properties for insert to authenticated
  with check (private.can_manage_org(org_id));
create policy properties_update on public.properties for update to authenticated
  using (private.can_manage_org(org_id)) with check (private.can_manage_org(org_id));
create policy properties_delete on public.properties for delete to authenticated
  using (private.can_manage_org(org_id));

-- unit_categories (internal: never public)
create policy unit_categories_select on public.unit_categories for select to authenticated
  using (org_id in (select private.user_org_ids()) or private.is_platform_admin());
create policy unit_categories_insert on public.unit_categories for insert to authenticated
  with check (private.can_manage_org(org_id));
create policy unit_categories_update on public.unit_categories for update to authenticated
  using (private.can_manage_org(org_id)) with check (private.can_manage_org(org_id));
create policy unit_categories_delete on public.unit_categories for delete to authenticated
  using (private.can_manage_org(org_id));

-- units
create policy units_select_public on public.units for select to anon
  using (is_published and private.property_is_public(property_id));
create policy units_select on public.units for select to authenticated
  using (
    org_id in (select private.user_org_ids()) or private.is_platform_admin()
    or (is_published and private.property_is_public(property_id))
  );
create policy units_insert on public.units for insert to authenticated
  with check (private.can_manage_org(org_id));
create policy units_update on public.units for update to authenticated
  using (private.can_manage_org(org_id)) with check (private.can_manage_org(org_id));
create policy units_delete on public.units for delete to authenticated
  using (private.can_manage_org(org_id));

-- unit_amenities
create policy unit_amenities_select on public.unit_amenities for select to authenticated
  using (org_id in (select private.user_org_ids()) or private.is_platform_admin());
create policy unit_amenities_insert on public.unit_amenities for insert to authenticated
  with check (private.can_manage_org(org_id));
create policy unit_amenities_delete on public.unit_amenities for delete to authenticated
  using (private.can_manage_org(org_id));

-- media
create policy media_select_public on public.media for select to anon
  using (
    private.property_is_public(property_id)
    and (unit_id is null or exists (select 1 from public.units u where u.id = unit_id and u.is_published))
  );
create policy media_select on public.media for select to authenticated
  using (
    org_id in (select private.user_org_ids()) or private.is_platform_admin()
    or (
      private.property_is_public(property_id)
      and (unit_id is null or exists (select 1 from public.units u where u.id = unit_id and u.is_published))
    )
  );
create policy media_insert on public.media for insert to authenticated
  with check (private.can_manage_org(org_id));
create policy media_update on public.media for update to authenticated
  using (private.can_manage_org(org_id)) with check (private.can_manage_org(org_id));
create policy media_delete on public.media for delete to authenticated
  using (private.can_manage_org(org_id));

-- ---------------------------------------------------------------- storage
-- Public read bucket for resized photos (the browser resizes before uploading).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 2097152, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- Reading goes through the public URL; this lets managers list and remove their own objects.
create policy media_objects_select on storage.objects for select to authenticated
  using (bucket_id = 'media' and private.can_manage_media_object(name));
create policy media_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and private.can_manage_media_object(name));
create policy media_objects_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and private.can_manage_media_object(name))
  with check (bucket_id = 'media' and private.can_manage_media_object(name));
create policy media_objects_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and private.can_manage_media_object(name));
