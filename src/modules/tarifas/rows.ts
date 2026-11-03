// Bridges between database rows and the pricing engine. Pure.

import type { Database, Json } from "@/lib/supabase/database.types";

import type { NightPrice, PricingResult, Quote, RateRule } from "./pricing";

const isInt = (v: unknown): v is number => Number.isInteger(v);

function isNight(v: unknown): v is NightPrice {
  if (typeof v !== "object" || v === null) return false;
  const n = v as Record<string, unknown>;
  return (
    typeof n.date === "string" &&
    typeof n.ruleName === "string" &&
    isInt(n.baseCents) &&
    isInt(n.extraGuests) &&
    isInt(n.extraCents) &&
    isInt(n.totalCents)
  );
}

/** The frozen breakdown as written by frozenPrice, or null if the stored JSON has another shape. */
export function storedQuote(json: Json | null): Quote | null {
  if (typeof json !== "object" || json === null || Array.isArray(json)) return null;
  const q = json as Record<string, unknown>;
  const ok =
    q.currency === "ARS" &&
    Array.isArray(q.nights) &&
    q.nights.every(isNight) &&
    ["subtotalCents", "discountPct", "discountCents", "totalCents", "depositPct", "depositCents"].every((k) => isInt(q[k]));
  return ok ? (json as unknown as Quote) : null;
}

type RateRuleRow = Pick<
  Database["public"]["Tables"]["rate_rules"]["Row"],
  | "id"
  | "kind"
  | "name"
  | "date_from"
  | "date_to"
  | "price_cents"
  | "guests_included"
  | "extra_guest_cents"
  | "min_nights"
  | "priority"
  | "created_at"
>;

export const RATE_RULE_COLUMNS =
  "id, kind, name, date_from, date_to, price_cents, guests_included, extra_guest_cents, min_nights, priority, created_at";

export function toRateRule(row: RateRuleRow): RateRule {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    dateFrom: row.date_from,
    dateTo: row.date_to,
    priceCents: row.price_cents,
    guestsIncluded: row.guests_included,
    extraGuestCents: row.extra_guest_cents,
    minNights: row.min_nights,
    priority: row.priority,
    createdAt: row.created_at,
  };
}

export type FrozenPrice =
  | { currency: "ARS"; total_cents: number; deposit_cents: number; price_breakdown: Json }
  | { total_cents: null; deposit_cents: null; price_breakdown: null };

/**
 * What to write into the booking: the frozen quote; no price when some night has no rate (it can be
 * computed later, and a moved stay never keeps its old price); nothing when the rules reject the stay.
 */
export function frozenPrice(result: PricingResult): FrozenPrice | null {
  if (result.ok) {
    return {
      currency: result.quote.currency,
      total_cents: result.quote.totalCents,
      deposit_cents: result.quote.depositCents,
      price_breakdown: result.quote as unknown as Json,
    };
  }
  if (result.error === "no_rate") return { total_cents: null, deposit_cents: null, price_breakdown: null };
  return null;
}
