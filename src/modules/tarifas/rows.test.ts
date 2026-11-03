import { describe, expect, it } from "vitest";

import type { Json } from "@/lib/supabase/database.types";

import type { Quote } from "./pricing";
import { frozenPrice, storedQuote, toRateRule } from "./rows";

describe("toRateRule", () => {
  it("maps a database row to the pricing engine's rule, keeping nulls", () => {
    expect(
      toRateRule({
        id: "r1",
        kind: "season",
        name: "Verano",
        date_from: "2030-01-01",
        date_to: "2030-02-28",
        price_cents: 1500000,
        guests_included: null,
        extra_guest_cents: null,
        min_nights: 3,
        priority: null,
        created_at: "2030-01-01T00:00:00+00:00",
      }),
    ).toEqual({
      id: "r1",
      kind: "season",
      name: "Verano",
      dateFrom: "2030-01-01",
      dateTo: "2030-02-28",
      priceCents: 1500000,
      guestsIncluded: null,
      extraGuestCents: null,
      minNights: 3,
      priority: null,
      createdAt: "2030-01-01T00:00:00+00:00",
    });
  });
});

describe("frozenPrice", () => {
  const q: Quote = {
    currency: "ARS",
    nights: [],
    subtotalCents: 1000,
    discountPct: 0,
    discountCents: 0,
    totalCents: 1000,
    depositPct: 30,
    depositCents: 300,
  };

  it("freezes total, deposit and the whole breakdown", () => {
    expect(frozenPrice({ ok: true, quote: q })).toEqual({
      currency: "ARS",
      total_cents: 1000,
      deposit_cents: 300,
      price_breakdown: q,
    });
  });

  it("clears the price when some night has no rate, so a moved stay never keeps an old price", () => {
    expect(frozenPrice({ ok: false, error: "no_rate", dates: ["2030-01-01"] })).toEqual({
      total_cents: null,
      deposit_cents: null,
      price_breakdown: null,
    });
  });

  it("reads a stored breakdown back, and refuses anything else", () => {
    expect(storedQuote(q as unknown as Json)).toEqual(q);
    expect(storedQuote(null)).toBeNull();
    expect(storedQuote({ nights: 3 })).toBeNull();
    expect(storedQuote({ ...q, totalCents: "1000" } as unknown as Json)).toBeNull();
  });

  it("writes nothing for a stay the rules reject", () => {
    expect(frozenPrice({ ok: false, error: "min_nights", minNights: 3 })).toBeNull();
    expect(frozenPrice({ ok: false, error: "invalid_stay" })).toBeNull();
  });
});
