import "server-only";

import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { listBookableUnits, type CalendarCategory, type CalendarUnit } from "@/modules/reservas/queries";

// Reads filter by the caller's organization (from the membership) on top of RLS.

export type RateRuleRow = Database["public"]["Tables"]["rate_rules"]["Row"];
export type DiscountRow = Pick<Database["public"]["Tables"]["length_discounts"]["Row"], "id" | "min_nights" | "pct">;

export type RatesPage = {
  property: { id: string; name: string; depositPct: number; weekendDays: number[] };
  rules: RateRuleRow[];
  discounts: DiscountRow[];
  units: CalendarUnit[];
  categories: CalendarCategory[];
};

export async function getRates(orgId: string, propertyId: string): Promise<RatesPage | null> {
  const supabase = await createClient();
  const { data: property, error } = await supabase
    .from("properties")
    .select("id, name, deposit_pct, weekend_days")
    .eq("org_id", orgId)
    .eq("id", propertyId)
    .maybeSingle();
  if (error) throw new Error("Could not load the property");
  if (!property) return null;

  const [rules, discounts, bookable] = await Promise.all([
    supabase.from("rate_rules").select("*").eq("org_id", orgId).eq("property_id", propertyId).order("kind").order("date_from").order("created_at"),
    supabase.from("length_discounts").select("id, min_nights, pct").eq("org_id", orgId).eq("property_id", propertyId).order("min_nights"),
    listBookableUnits(orgId, propertyId),
  ]);
  if (rules.error || discounts.error) throw new Error("Could not load the rates");
  return {
    property: { id: property.id, name: property.name, depositPct: property.deposit_pct, weekendDays: property.weekend_days },
    rules: rules.data,
    discounts: discounts.data,
    ...bookable,
  };
}

export async function listHolidays(): Promise<{ date: string; name: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("holidays").select("date, name").order("date");
  if (error) throw new Error("Could not load the holidays");
  return data;
}
