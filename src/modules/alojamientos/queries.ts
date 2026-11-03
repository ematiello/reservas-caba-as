import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type Tables = Database["public"]["Tables"];
export type Property = Tables["properties"]["Row"];
export type Unit = Tables["units"]["Row"];
export type UnitCategory = Tables["unit_categories"]["Row"];
export type Media = Tables["media"]["Row"];
export type Amenity = Tables["amenities"]["Row"];

// Reads always filter by the caller's organization (taken from their membership, never from the
// form) on top of RLS, so a page never mixes organizations even for the platform admin.

export async function listProperties(orgId: string): Promise<(Property & { unitCount: number })[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .select("*, units(count)")
    .eq("org_id", orgId)
    .order("created_at");
  if (error) throw new Error("Could not load properties");
  return data.map(({ units, ...p }) => ({ ...p, unitCount: units[0]?.count ?? 0 }));
}

export type PropertyDetail = {
  property: Property;
  categories: UnitCategory[];
  units: Unit[];
  media: Media[];
};

export async function getProperty(orgId: string, propertyId: string): Promise<PropertyDetail | null> {
  const supabase = await createClient();
  const [propRes, catRes, unitRes, mediaRes] = await Promise.all([
    supabase.from("properties").select("*").eq("org_id", orgId).eq("id", propertyId).maybeSingle(),
    supabase.from("unit_categories").select("*").eq("org_id", orgId).eq("property_id", propertyId).order("name"),
    supabase.from("units").select("*").eq("org_id", orgId).eq("property_id", propertyId).order("sort").order("name"),
    supabase.from("media").select("*").eq("org_id", orgId).eq("property_id", propertyId).is("unit_id", null).order("sort"),
  ]);
  if (propRes.error || catRes.error || unitRes.error || mediaRes.error) throw new Error("Could not load the property");
  if (!propRes.data) return null;
  return { property: propRes.data, categories: catRes.data, units: unitRes.data, media: mediaRes.data };
}

export type UnitDetail = {
  property: Property;
  unit: Unit;
  categories: UnitCategory[];
  amenities: Amenity[];
  selectedAmenityIds: Set<string>;
  media: Media[];
};

export async function getUnit(orgId: string, propertyId: string, unitId: string): Promise<UnitDetail | null> {
  const supabase = await createClient();
  const [propRes, unitRes, catRes, amenRes, selRes, mediaRes] = await Promise.all([
    supabase.from("properties").select("*").eq("org_id", orgId).eq("id", propertyId).maybeSingle(),
    supabase.from("units").select("*").eq("org_id", orgId).eq("property_id", propertyId).eq("id", unitId).maybeSingle(),
    supabase.from("unit_categories").select("*").eq("org_id", orgId).eq("property_id", propertyId).order("name"),
    supabase.from("amenities").select("*").order("name"),
    supabase.from("unit_amenities").select("amenity_id").eq("org_id", orgId).eq("unit_id", unitId),
    supabase.from("media").select("*").eq("org_id", orgId).eq("unit_id", unitId).order("sort"),
  ]);
  if ([propRes, unitRes, catRes, amenRes, selRes, mediaRes].some((r) => r.error)) throw new Error("Could not load the unit");
  if (!propRes.data || !unitRes.data) return null;
  return {
    property: propRes.data,
    unit: unitRes.data,
    categories: catRes.data ?? [],
    amenities: amenRes.data ?? [],
    selectedAmenityIds: new Set((selRes.data ?? []).map((r) => r.amenity_id)),
    media: mediaRes.data ?? [],
  };
}

export function publicMediaUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/media/${storagePath}`;
}
