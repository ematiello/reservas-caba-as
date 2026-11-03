import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import type { ISODate } from "@/modules/reservas/calendar";

import { quote, type PricingResult } from "./pricing";
import { frozenPrice, RATE_RULE_COLUMNS, toRateRule } from "./rows";

// Prices are computed here, on the server, from the rules the caller's own session can read (RLS);
// the client never sends amounts. Only the frozen result is written with the service_role client,
// always scoped to the caller's organization and to a booking that session already read.

export type Stay = { unitId: string; checkIn: ISODate; checkOut: ISODate; guests: number };

export async function quoteStay(orgId: string, stay: Stay): Promise<PricingResult> {
  return quoteWith(await createClient(), orgId, stay);
}

/**
 * Prices a stay from the rules `supabase` can read: the member's session in the panel, or the
 * anonymous client on the public page (RLS shows it only published properties of active accounts).
 */
export async function quoteWith(supabase: SupabaseClient<Database>, orgId: string, stay: Stay): Promise<PricingResult> {
  const { data: unit, error } = await supabase
    .from("units")
    .select("property_id, category_id, properties(weekend_days, deposit_pct)")
    .eq("org_id", orgId)
    .eq("id", stay.unitId)
    .single();
  if (error || !unit.properties) throw new Error("Could not load the unit to price");

  const target = unit.category_id ? `unit_id.eq.${stay.unitId},category_id.eq.${unit.category_id}` : `unit_id.eq.${stay.unitId}`;
  const [rules, discounts, holidays] = await Promise.all([
    supabase.from("rate_rules").select(RATE_RULE_COLUMNS).eq("org_id", orgId).eq("property_id", unit.property_id).or(target),
    supabase.from("length_discounts").select("min_nights, pct").eq("org_id", orgId).eq("property_id", unit.property_id),
    supabase.from("holidays").select("date").gte("date", stay.checkIn).lt("date", stay.checkOut),
  ]);
  if (rules.error || discounts.error || holidays.error) throw new Error("Could not load the rates");

  return quote({
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    guests: stay.guests,
    rules: rules.data.map(toRateRule),
    weekendDays: unit.properties.weekend_days,
    holidays: holidays.data.map((h) => h.date),
    discounts: discounts.data.map((d) => ({ minNights: d.min_nights, pct: d.pct })),
    depositPct: unit.properties.deposit_pct,
  });
}

/**
 * Freezes the quote into the booking (or clears it when a night has no rate). False on failure.
 * `onlyIfUnpriced` makes "compute if missing" idempotent: a price frozen meanwhile is kept.
 */
export async function writeFrozenPrice(
  orgId: string,
  bookingId: string,
  result: PricingResult,
  { onlyIfUnpriced = false }: { onlyIfUnpriced?: boolean } = {},
): Promise<boolean> {
  const values = frozenPrice(result);
  if (!values) return false;
  return adminWrite("frozen price", () => {
    const query = createAdminClient().from("bookings").update(values).eq("org_id", orgId).eq("id", bookingId).eq("kind", "booking");
    return (onlyIfUnpriced ? query.is("total_cents", null) : query).select("id");
  });
}

/** Drops a booking's price when its stay changed but could not be priced again. False on failure. */
export async function clearFrozenPrice(orgId: string, bookingId: string): Promise<boolean> {
  return adminWrite("frozen price", () =>
    createAdminClient()
      .from("bookings")
      .update({ total_cents: null, deposit_cents: null, price_breakdown: null })
      .eq("org_id", orgId)
      .eq("id", bookingId)
      .eq("kind", "booking")
      .select("id"),
  );
}

// The booking already exists when these run: a failure (even a missing server key) must not turn
// into an error page. It is logged, and the booking stays without a price until computed again.
async function adminWrite(what: string, run: () => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<boolean> {
  try {
    const { data, error } = await run();
    if (error) console.error(`[tarifas] ${what} write failed`, error);
    return !error && data?.length === 1;
  } catch (error) {
    console.error(`[tarifas] ${what} write failed`, error);
    return false;
  }
}

/** The owner's adjustment of one booking's deposit (docs/01). The caller checks the role. */
export async function writeDeposit(orgId: string, bookingId: string, depositCents: number): Promise<boolean> {
  return adminWrite("deposit", () =>
    createAdminClient()
      .from("bookings")
      .update({ deposit_cents: depositCents })
      .eq("org_id", orgId)
      .eq("id", bookingId)
      .eq("kind", "booking")
      .not("total_cents", "is", null)
      .gte("total_cents", depositCents)
      .select("id"),
  );
}
