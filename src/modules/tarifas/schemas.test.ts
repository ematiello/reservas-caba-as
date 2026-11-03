import { describe, expect, it } from "vitest";

import { centsToPesosInput, discountSchema, holidaySchema, rateRuleSchema } from "./schemas";

const U = "11111111-1111-4111-8111-111111111111";
const C = "22222222-2222-4222-8222-222222222222";

const valid = {
  target: `unit:${U}`,
  kind: "season",
  name: " Verano ",
  dateFrom: "2030-01-01",
  dateTo: "2030-02-28",
  price: "15.000",
  guestsIncluded: "",
  extraGuest: "",
  minNights: "3",
  priority: "",
};

describe("rateRuleSchema", () => {
  it("parses a season for a unit, in cents, with empty optionals as null", () => {
    expect(rateRuleSchema.parse(valid)).toEqual({
      unitId: U,
      categoryId: null,
      kind: "season",
      name: "Verano",
      dateFrom: "2030-01-01",
      dateTo: "2030-02-28",
      priceCents: 1_500_000,
      guestsIncluded: null,
      extraGuestCents: null,
      minNights: 3,
      priority: null,
    });
  });

  it("targets a category, and a base rate needs no dates", () => {
    const r = rateRuleSchema.parse({ ...valid, target: `category:${C}`, kind: "base", dateFrom: "", dateTo: "" });
    expect(r).toMatchObject({ unitId: null, categoryId: C, dateFrom: null, dateTo: null });
  });

  it("takes extra guests only together with the guests included", () => {
    expect(rateRuleSchema.parse({ ...valid, guestsIncluded: "2", extraGuest: "2.500" })).toMatchObject({
      guestsIncluded: 2,
      extraGuestCents: 250_000,
    });
    expect(rateRuleSchema.safeParse({ ...valid, guestsIncluded: "2" }).success).toBe(false);
    expect(rateRuleSchema.safeParse({ ...valid, extraGuest: "100" }).success).toBe(false);
  });

  it("seasons and special dates need both dates, in order", () => {
    expect(rateRuleSchema.safeParse({ ...valid, dateTo: "" }).success).toBe(false);
    expect(rateRuleSchema.safeParse({ ...valid, kind: "special", dateFrom: "", dateTo: "" }).success).toBe(false);
    expect(rateRuleSchema.safeParse({ ...valid, dateFrom: "2030-03-01" }).success).toBe(false);
    expect(rateRuleSchema.safeParse({ ...valid, kind: "weekend", dateFrom: "2030-01-01", dateTo: "" }).success).toBe(false);
  });

  it("rejects bad targets, kinds, prices and caps", () => {
    for (const patch of [
      { target: `room:${U}` },
      { target: "unit:nope" },
      { kind: "promo" },
      { price: "" },
      { price: "-1" },
      { minNights: "0" },
      { minNights: "366" },
      { priority: "1001" },
      { name: "" },
    ]) {
      expect(rateRuleSchema.safeParse({ ...valid, ...patch }).success, JSON.stringify(patch)).toBe(false);
    }
  });

  it("accepts a price of zero (a free night is a valid rate)", () => {
    expect(rateRuleSchema.parse({ ...valid, price: "0" }).priceCents).toBe(0);
  });
});

describe("centsToPesosInput", () => {
  it("writes cents back as pesos the form parses again to the same cents", () => {
    for (const [cents, text] of [
      [1_500_000, "15000"],
      [1_500_050, "15000,50"],
      [5, "0,05"],
      [0, "0"],
    ] as const) {
      expect(centsToPesosInput(cents)).toBe(text);
      expect(rateRuleSchema.parse({ ...valid, price: text }).priceCents).toBe(cents);
    }
    expect(centsToPesosInput(null)).toBe("");
  });
});

describe("holidaySchema", () => {
  it("needs a real date and a name", () => {
    expect(holidaySchema.parse({ date: "2030-07-09", name: " Independencia " })).toEqual({ date: "2030-07-09", name: "Independencia" });
    expect(holidaySchema.safeParse({ date: "2030-02-30", name: "X" }).success).toBe(false);
    expect(holidaySchema.safeParse({ date: "2030-07-09", name: " " }).success).toBe(false);
  });
});

describe("discountSchema", () => {
  it("parses nights and percentage within the technical caps", () => {
    expect(discountSchema.parse({ minNights: "7", pct: "10" })).toEqual({ minNights: 7, pct: 10 });
    for (const bad of [{ minNights: "1", pct: "10" }, { minNights: "7", pct: "0" }, { minNights: "7", pct: "101" }]) {
      expect(discountSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });
});
