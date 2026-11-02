import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { createPublicClient } from "@/lib/supabase/public";
import { publicMediaUrl } from "@/modules/alojamientos/queries";
import type { Database } from "@/lib/supabase/database.types";
import type { ISODate } from "@/modules/reservas/calendar";
import { quoteWith } from "@/modules/tarifas/server";
import type { PricingResult } from "@/modules/tarifas/pricing";

import type { OccupiedRange, StayQuery } from "./stay";
import { PUBLIC_PROPERTIES_TAG } from "./tags";

// Everything here reads as an anonymous visitor (RLS `anon`): published properties and units of
// active accounts, never guests or bookings. The property's content is cached and tagged; panel
// saves expire the tag. Page state and availability are always read live.

export type PageState = "published" | "unavailable" | "missing";
export type Photo = { url: string; alt: string };
export type Amenity = { code: string; name: string };
export type PublicUnit = {
  id: string;
  name: string;
  kind: Database["public"]["Enums"]["unit_kind"];
  description: string;
  maxGuests: number;
  bedrooms: number | null;
  beds: number | null;
  categoryName: string | null;
  amenities: Amenity[];
  photos: Photo[];
};
export type PublicProperty = {
  id: string;
  orgId: string;
  slug: string;
  name: string;
  description: string;
  address: string | null;
  city: string | null;
  province: string | null;
  lat: number | null;
  lng: number | null;
  timezone: string;
  whatsapp: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  cleaningBufferDays: number;
  updatedAt: string;
  photos: Photo[];
  units: PublicUnit[];
};

export async function getPageState(slug: string): Promise<PageState> {
  const { data, error } = await createPublicClient().rpc("public_property_state", { p_slug: slug });
  if (error) throw new Error("Could not read the page state");
  return data === "published" || data === "unavailable" ? data : "missing";
}

/** Cached for hours; `null` when the property is not public. */
export async function getPublicProperty(slug: string): Promise<PublicProperty | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(PUBLIC_PROPERTIES_TAG);
  return loadPublicProperty(slug);
}

/** Uncached read, for when the live state says "published" but the cache still holds an old miss. */
export async function loadPublicProperty(slug: string): Promise<PublicProperty | null> {
  const supabase = createPublicClient();
  const { data: p, error } = await supabase
    .from("properties")
    .select(
      "id, org_id, slug, name, description, address, city, province, lat, lng, timezone, whatsapp, check_in_time, check_out_time, cleaning_buffer_days, updated_at",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error("Could not read the property");
  if (!p) return null;

  const [units, categories, amenities, media] = await Promise.all([
    supabase
      .from("units")
      .select("id, name, kind, description, max_guests, bedrooms, beds, category_id")
      .eq("property_id", p.id)
      .order("sort")
      .order("name"),
    supabase.from("unit_categories").select("id, name").eq("property_id", p.id),
    supabase.from("unit_amenities").select("unit_id, amenities(code, name)").eq("org_id", p.org_id),
    supabase.from("media").select("unit_id, storage_path, alt").eq("property_id", p.id).order("sort"),
  ]);
  if (units.error || categories.error || amenities.error || media.error) throw new Error("Could not read the units");

  const photo = (m: { storage_path: string; alt: string }): Photo => ({ url: publicMediaUrl(m.storage_path), alt: m.alt });
  const categoryName = new Map(categories.data.map((c) => [c.id, c.name]));

  return {
    id: p.id,
    orgId: p.org_id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    address: p.address,
    city: p.city,
    province: p.province,
    lat: p.lat,
    lng: p.lng,
    timezone: p.timezone,
    whatsapp: p.whatsapp,
    checkInTime: p.check_in_time,
    checkOutTime: p.check_out_time,
    cleaningBufferDays: p.cleaning_buffer_days,
    updatedAt: p.updated_at,
    photos: media.data.filter((m) => m.unit_id === null).map(photo),
    units: units.data.map((u) => ({
      id: u.id,
      name: u.name,
      kind: u.kind,
      description: u.description,
      maxGuests: u.max_guests,
      bedrooms: u.bedrooms,
      beds: u.beds,
      categoryName: u.category_id ? (categoryName.get(u.category_id) ?? null) : null,
      amenities: amenities.data
        .filter((a) => a.unit_id === u.id && a.amenities)
        .map((a) => ({ code: a.amenities!.code, name: a.amenities!.name }))
        .sort((a, b) => a.name.localeCompare(b.name, "es")),
      photos: media.data.filter((m) => m.unit_id === u.id).map(photo),
    })),
  };
}

/** Occupied ranges of the published units that touch [from, to): dates only (invariant 7). */
export async function getOccupied(slug: string, from: ISODate, to: ISODate): Promise<OccupiedRange[]> {
  const { data, error } = await createPublicClient().rpc("public_availability", { p_slug: slug, p_from: from, p_to: to });
  if (error) throw new Error("Could not read the availability");
  return data.map((r) => ({ unitId: r.unit_id, startsOn: r.starts_on, endsOn: r.ends_on }));
}

/** The server's price for a stay (list prices only); null when the rates cannot be read. */
export async function quotePublicStay(orgId: string, unitId: string, stay: StayQuery): Promise<PricingResult | null> {
  try {
    return await quoteWith(createPublicClient(), orgId, { unitId, ...stay });
  } catch {
    return null;
  }
}

export type PublicListing = { slug: string; name: string; city: string | null; updatedAt: string; photo: Photo | null };

/** Published properties, for the home page and the sitemap. */
export async function listPublicProperties(): Promise<PublicListing[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(PUBLIC_PROPERTIES_TAG);
  const supabase = createPublicClient();
  const [properties, media] = await Promise.all([
    supabase.from("properties").select("id, slug, name, city, updated_at").order("name"),
    supabase.from("media").select("property_id, storage_path, alt").is("unit_id", null).order("sort"),
  ]);
  if (properties.error || media.error) throw new Error("Could not list the properties");
  return properties.data.map((p) => {
    const first = media.data.find((m) => m.property_id === p.id);
    return {
      slug: p.slug,
      name: p.name,
      city: p.city,
      updatedAt: p.updated_at,
      photo: first ? { url: publicMediaUrl(first.storage_path), alt: first.alt } : null,
    };
  });
}
