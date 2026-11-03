import { describe, expect, it } from "vitest";

import { quote, type PricingInput, type RateRule } from "./pricing";

// 2030-01-07 is a Monday; Friday 11 and Saturday 12 are weekend nights by default.
let seq = 0;
function rule(partial: Partial<RateRule> & Pick<RateRule, "kind" | "priceCents">): RateRule {
  seq += 1;
  return {
    id: `r${seq}`,
    name: partial.kind,
    dateFrom: null,
    dateTo: null,
    guestsIncluded: null,
    extraGuestCents: null,
    minNights: null,
    priority: null,
    createdAt: new Date(Date.UTC(2030, 0, 1) + seq * 1000).toISOString(),
    ...partial,
  };
}

const base = rule({ kind: "base", priceCents: 10_000_00 });

function input(partial: Partial<PricingInput>): PricingInput {
  return {
    checkIn: "2030-01-07",
    checkOut: "2030-01-10",
    guests: 2,
    rules: [base],
    weekendDays: [5, 6],
    holidays: [],
    discounts: [],
    depositPct: 30,
    ...partial,
  };
}

function nightly(result: ReturnType<typeof quote>) {
  if (!result.ok) throw new Error(`expected a quote, got ${result.error}`);
  return result.quote.nights.map((n) => [n.date, n.ruleId, n.totalCents]);
}

describe("quote: minimal cases (docs/04)", () => {
  it("1. a stay with only the base rate", () => {
    const r = quote(input({}));
    expect(nightly(r)).toEqual([
      ["2030-01-07", base.id, 10_000_00],
      ["2030-01-08", base.id, 10_000_00],
      ["2030-01-09", base.id, 10_000_00],
    ]);
    expect(r.ok && r.quote).toMatchObject({ subtotalCents: 30_000_00, discountCents: 0, totalCents: 30_000_00, currency: "ARS" });
  });

  it("2. a stay crossing the start of a season gets different nightly prices", () => {
    const season = rule({ kind: "season", priceCents: 15_000_00, dateFrom: "2030-01-09", dateTo: "2030-02-28" });
    expect(nightly(quote(input({ rules: [base, season], checkOut: "2030-01-11" })))).toEqual([
      ["2030-01-07", base.id, 10_000_00],
      ["2030-01-08", base.id, 10_000_00],
      ["2030-01-09", season.id, 15_000_00],
      ["2030-01-10", season.id, 15_000_00],
    ]);
  });

  it("3. a holiday inside the season wins", () => {
    const season = rule({ kind: "season", priceCents: 15_000_00, dateFrom: "2030-01-01", dateTo: "2030-01-31" });
    const holiday = rule({ kind: "holiday", priceCents: 20_000_00 });
    const r = quote(input({ rules: [base, season, holiday], holidays: ["2030-01-08"] }));
    expect(nightly(r).map((n) => n[1])).toEqual([season.id, holiday.id, season.id]);
  });

  it("4. a weekend in season wins; on equal priority the newest rule wins", () => {
    const season = rule({ kind: "season", priceCents: 15_000_00, dateFrom: "2030-01-01", dateTo: "2030-01-31" });
    const weekend = rule({ kind: "weekend", priceCents: 18_000_00 });
    const stay = { checkIn: "2030-01-10", checkOut: "2030-01-13" }; // Thu, Fri, Sat
    expect(nightly(quote(input({ ...stay, rules: [base, season, weekend] }))).map((n) => n[1])).toEqual([
      season.id,
      weekend.id,
      weekend.id,
    ]);

    const older = rule({ kind: "season", priceCents: 1, dateFrom: "2030-01-01", dateTo: "2030-01-31", priority: 50 });
    const newer = rule({ kind: "special", priceCents: 2, dateFrom: "2030-01-10", dateTo: "2030-01-10", priority: 50 });
    // Same priority: the newer one wins, whatever its kind and wherever it sits in the list.
    expect(nightly(quote(input({ ...stay, rules: [newer, older] })))[0][1]).toBe(newer.id);
  });

  it("5. a special date beats everything", () => {
    const holiday = rule({ kind: "holiday", priceCents: 20_000_00 });
    const special = rule({ kind: "special", priceCents: 50_000_00, dateFrom: "2030-01-08", dateTo: "2030-01-08" });
    const r = quote(input({ rules: [special, holiday, base], holidays: ["2030-01-08"] }));
    expect(nightly(r)[1]).toEqual(["2030-01-08", special.id, 50_000_00]);
  });

  it("6. extra guests over the included ones pay per night", () => {
    const withExtras = rule({ kind: "base", priceCents: 10_000_00, guestsIncluded: 2, extraGuestCents: 2_500_00 });
    const r = quote(input({ rules: [withExtras], guests: 4 }));
    expect(r.ok && r.quote.nights[0]).toMatchObject({ baseCents: 10_000_00, extraGuests: 2, extraCents: 5_000_00, totalCents: 15_000_00 });
    expect(r.ok && r.quote.subtotalCents).toBe(45_000_00);
  });

  it("7. a minimum stay not met is an error carrying the minimum", () => {
    const season = rule({ kind: "season", priceCents: 15_000_00, dateFrom: "2030-01-08", dateTo: "2030-01-31", minNights: 5 });
    expect(quote(input({ rules: [base, season] }))).toEqual({ ok: false, error: "min_nights", minNights: 5 });
  });

  it("8. the length discount applies to the subtotal, the largest one that qualifies", () => {
    const r = quote(
      input({
        checkOut: "2030-01-14", // 7 nights
        discounts: [
          { minNights: 3, pct: 5 },
          { minNights: 7, pct: 10 },
          { minNights: 14, pct: 20 },
        ],
      }),
    );
    expect(r.ok && r.quote).toMatchObject({ subtotalCents: 70_000_00, discountPct: 10, discountCents: 7_000_00, totalCents: 63_000_00 });
  });

  it("9. the deposit is the property's percentage, rounded to the cent", () => {
    const odd = rule({ kind: "base", priceCents: 333 }); // 3 nights = 999 cents
    const r = quote(input({ rules: [odd], depositPct: 30 }));
    expect(r.ok && r.quote).toMatchObject({ totalCents: 999, depositPct: 30, depositCents: 300 }); // 299.7 → 300
  });
});

describe("quote: edges", () => {
  it("reports the nights without any rule instead of guessing a price", () => {
    const season = rule({ kind: "season", priceCents: 1, dateFrom: "2030-01-08", dateTo: "2030-01-08" });
    expect(quote(input({ rules: [season] }))).toEqual({ ok: false, error: "no_rate", dates: ["2030-01-07", "2030-01-09"] });
  });

  it("uses the configured weekend days", () => {
    const weekend = rule({ kind: "weekend", priceCents: 1 });
    // Sunday (0) only: the night of Sunday 13 is weekend, Friday 11 is not.
    const r = quote(input({ rules: [base, weekend], weekendDays: [0], checkIn: "2030-01-11", checkOut: "2030-01-14" }));
    expect(nightly(r).map((n) => n[1])).toEqual([base.id, base.id, weekend.id]);
  });

  it("an explicit priority overrides the kind's default", () => {
    const strongSeason = rule({ kind: "season", priceCents: 1, dateFrom: "2030-01-01", dateTo: "2030-01-31", priority: 100 });
    const special = rule({ kind: "special", priceCents: 2, dateFrom: "2030-01-07", dateTo: "2030-01-09" });
    expect(nightly(quote(input({ rules: [special, strongSeason] }))).every((n) => n[1] === strongSeason.id)).toBe(true);
  });

  it("a weekend or holiday rule with dates only applies inside them", () => {
    const weekend = rule({ kind: "weekend", priceCents: 1, dateFrom: "2030-02-01", dateTo: "2030-02-28" });
    const r = quote(input({ rules: [base, weekend], checkIn: "2030-01-11", checkOut: "2030-01-13" }));
    expect(nightly(r).map((n) => n[1])).toEqual([base.id, base.id]);
  });

  it("the minimum stay is the largest among the rules applied, and is met when equal", () => {
    const a = rule({ kind: "base", priceCents: 1, minNights: 2 });
    const b = rule({ kind: "weekend", priceCents: 1, minNights: 3 });
    expect(quote(input({ rules: [a, b], checkIn: "2030-01-10", checkOut: "2030-01-12" }))).toEqual({
      ok: false,
      error: "min_nights",
      minNights: 3,
    });
    expect(quote(input({ rules: [a, b], checkIn: "2030-01-10", checkOut: "2030-01-13" })).ok).toBe(true);
  });

  it("a deposit of 0 % or 100 % is exact", () => {
    expect(quote(input({ depositPct: 0 }))).toMatchObject({ ok: true, quote: { depositCents: 0 } });
    expect(quote(input({ depositPct: 100 }))).toMatchObject({ ok: true, quote: { depositCents: 30_000_00 } });
  });

  it("compares creation times as instants, whatever their text format", () => {
    // 00:45 at UTC-1 is 01:45 UTC: later than 01:00 UTC, although it sorts first as text.
    const later = rule({ kind: "base", priceCents: 1, createdAt: "2030-01-01T00:45:00-01:00" });
    const earlier = rule({ kind: "base", priceCents: 2, createdAt: "2030-01-01T01:00:00Z" });
    expect(nightly(quote(input({ rules: [earlier, later] })))[0][1]).toBe(later.id);
  });

  it("a full tie (priority and creation time) does not depend on the order of the rules", () => {
    const createdAt = "2030-01-01T00:00:00Z";
    const a = rule({ kind: "base", priceCents: 1, createdAt, id: "a" });
    const b = rule({ kind: "base", priceCents: 2, createdAt, id: "b" });
    const first = nightly(quote(input({ rules: [a, b] })))[0][1];
    expect(nightly(quote(input({ rules: [b, a] })))[0][1]).toBe(first);
  });

  it("rejects an empty or reversed stay", () => {
    expect(quote(input({ checkOut: "2030-01-07" }))).toEqual({ ok: false, error: "invalid_stay" });
    expect(quote(input({ checkOut: "2030-01-05" }))).toEqual({ ok: false, error: "invalid_stay" });
  });

  it("does not change its inputs", () => {
    const rules = [base, rule({ kind: "weekend", priceCents: 1 })];
    const frozen = JSON.stringify(rules);
    quote(input({ rules }));
    expect(JSON.stringify(rules)).toBe(frozen);
  });
});
