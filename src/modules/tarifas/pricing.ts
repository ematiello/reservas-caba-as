// Price of a stay, night by night (docs/01, "Reglas de tarifas"). Pure: no I/O, no clock, inputs are
// never mutated, so it runs the same in tests and on the server. Amounts are integer cents (ARS).

import { addDays, type ISODate } from "@/modules/reservas/calendar";

export type RateKind = "base" | "season" | "weekend" | "holiday" | "special";

export const DEFAULT_PRIORITY: Record<RateKind, number> = { base: 0, season: 10, weekend: 20, holiday: 30, special: 40 };

export type RateRule = {
  id: string;
  kind: RateKind;
  name: string;
  /** Nights from/to, inclusive. Null on both ends means "any night". */
  dateFrom: ISODate | null;
  dateTo: ISODate | null;
  priceCents: number;
  guestsIncluded: number | null;
  extraGuestCents: number | null;
  minNights: number | null;
  /** Null takes the kind's default. */
  priority: number | null;
  createdAt: string;
};

export type LengthDiscount = { minNights: number; pct: number };

export type PricingInput = {
  checkIn: ISODate;
  /** Exclusive: 10 → 13 prices the nights of the 10th, 11th and 12th. */
  checkOut: ISODate;
  guests: number;
  /** Rules of the unit and of its category. */
  rules: RateRule[];
  /** Weekdays whose night is a weekend night, 0 = Sunday (property.weekend_days). */
  weekendDays: number[];
  holidays: ISODate[];
  discounts: LengthDiscount[];
  depositPct: number;
};

export type NightPrice = {
  date: ISODate;
  ruleId: string;
  ruleName: string;
  kind: RateKind;
  baseCents: number;
  extraGuests: number;
  extraCents: number;
  totalCents: number;
};

export type Quote = {
  currency: "ARS";
  nights: NightPrice[];
  subtotalCents: number;
  discountPct: number;
  discountCents: number;
  totalCents: number;
  depositPct: number;
  depositCents: number;
};

export type PricingResult =
  | { ok: true; quote: Quote }
  | { ok: false; error: "no_rate"; dates: ISODate[] }
  | { ok: false; error: "min_nights"; minNights: number }
  | { ok: false; error: "invalid_stay" };

/** amount × pct / 100, rounded to the nearest cent (half up). */
export function percentOf(amountCents: number, pct: number): number {
  return Math.floor((amountCents * pct + 50) / 100);
}

function weekday(date: ISODate): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function applies(rule: RateRule, night: ISODate, input: PricingInput, holidays: Set<ISODate>): boolean {
  if (rule.dateFrom !== null && night < rule.dateFrom) return false;
  if (rule.dateTo !== null && night > rule.dateTo) return false;
  switch (rule.kind) {
    case "base":
      return true;
    case "season":
    case "special":
      return rule.dateFrom !== null && rule.dateTo !== null;
    case "weekend":
      return input.weekendDays.includes(weekday(night));
    case "holiday":
      return holidays.has(night);
  }
}

const priorityOf = (rule: RateRule) => rule.priority ?? DEFAULT_PRIORITY[rule.kind];

// Highest priority first; on a tie, the most recently created (as an instant, not as text); on a
// full tie, the larger id, so the result never depends on the order the rules arrive in.
function wins(a: RateRule, b: RateRule): boolean {
  const pa = priorityOf(a);
  const pb = priorityOf(b);
  if (pa !== pb) return pa > pb;
  const ta = Date.parse(a.createdAt);
  const tb = Date.parse(b.createdAt);
  if (ta !== tb) return ta > tb;
  return a.id > b.id;
}

export function quote(input: PricingInput): PricingResult {
  if (input.checkOut <= input.checkIn) return { ok: false, error: "invalid_stay" };
  const holidays = new Set(input.holidays);
  const nights: NightPrice[] = [];
  const missing: ISODate[] = [];
  let minNights = 0;

  for (let night = input.checkIn; night < input.checkOut; night = addDays(night, 1)) {
    let best: RateRule | null = null;
    for (const rule of input.rules) {
      if (applies(rule, night, input, holidays) && (best === null || wins(rule, best))) best = rule;
    }
    if (best === null) {
      missing.push(night);
      continue;
    }
    minNights = Math.max(minNights, best.minNights ?? 0);
    const extraGuests =
      best.guestsIncluded !== null && best.extraGuestCents !== null ? Math.max(0, input.guests - best.guestsIncluded) : 0;
    const extraCents = extraGuests * (best.extraGuestCents ?? 0);
    nights.push({
      date: night,
      ruleId: best.id,
      ruleName: best.name,
      kind: best.kind,
      baseCents: best.priceCents,
      extraGuests,
      extraCents,
      totalCents: best.priceCents + extraCents,
    });
  }

  if (missing.length) return { ok: false, error: "no_rate", dates: missing };
  if (nights.length < minNights) return { ok: false, error: "min_nights", minNights };

  const subtotalCents = nights.reduce((sum, n) => sum + n.totalCents, 0);
  const discountPct = input.discounts.reduce((best, d) => (nights.length >= d.minNights && d.pct > best ? d.pct : best), 0);
  const discountCents = percentOf(subtotalCents, discountPct);
  const totalCents = subtotalCents - discountCents;
  return {
    ok: true,
    quote: {
      currency: "ARS",
      nights,
      subtotalCents,
      discountPct,
      discountCents,
      totalCents,
      depositPct: input.depositPct,
      depositCents: percentOf(totalCents, input.depositPct),
    },
  };
}
