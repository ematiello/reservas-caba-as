import { describe, expect, it } from "vitest";

import { discountSchema, parsePesosToCents, paymentSchema, planSchema, settingsSchema } from "./schemas";

describe("parsePesosToCents", () => {
  it.each([
    ["12000", 1_200_000],
    ["12.000", 1_200_000],
    ["12.345,50", 1_234_550],
    ["12345,5", 1_234_550],
    ["12345.50", 1_234_550],
    [" $ 1.000 ", 100_000],
    ["0", 0],
  ])("parses %s", (input, cents) => {
    expect(parsePesosToCents(input)).toBe(cents);
  });

  it.each(["", "abc", "-5", "1,2,3", "12,345"])("rejects %s", (input) => {
    expect(parsePesosToCents(input)).toBeNull();
  });
});

describe("planSchema", () => {
  it("converts the price to cents and empty limits to unlimited", () => {
    const parsed = planSchema.parse({ name: " Básico ", price: "15.000", maxUnits: "", maxMembers: "3", isActive: "on" });
    expect(parsed).toEqual({ name: "Básico", priceCents: 1_500_000, maxUnits: null, maxMembers: 3, isActive: true });
  });

  it("rejects an invalid price or a non-positive limit", () => {
    expect(planSchema.safeParse({ name: "Pro", price: "abc", maxUnits: "", maxMembers: "" }).success).toBe(false);
    expect(planSchema.safeParse({ name: "Pro", price: "1", maxUnits: "0", maxMembers: "" }).success).toBe(false);
  });

  it("treats a missing checkbox as inactive", () => {
    expect(planSchema.parse({ name: "Pro", price: "1", maxUnits: "", maxMembers: "" }).isActive).toBe(false);
  });
});

describe("settingsSchema", () => {
  it("accepts the database ranges only", () => {
    expect(settingsSchema.parse({ trialDays: "7", graceDays: "0" })).toEqual({ trialDays: 7, graceDays: 0 });
    expect(settingsSchema.safeParse({ trialDays: "0", graceDays: "0" }).success).toBe(false);
    expect(settingsSchema.safeParse({ trialDays: "7", graceDays: "61" }).success).toBe(false);
  });
});

describe("paymentSchema", () => {
  const base = {
    orgId: "6f1d2c1e-3b0a-4c9e-9a64-2f0f6a1b2c3d",
    amount: "15.000",
    method: "transfer",
    paidAt: "2026-11-01",
    months: "1",
    notes: "",
  };

  it("parses a payment", () => {
    expect(paymentSchema.parse(base)).toEqual({
      orgId: base.orgId,
      amountCents: 1_500_000,
      method: "transfer",
      paidAt: "2026-11-01",
      months: 1,
      notes: null,
    });
  });

  it("rejects an unknown method, a bad date or months out of range", () => {
    expect(paymentSchema.safeParse({ ...base, method: "card" }).success).toBe(false);
    expect(paymentSchema.safeParse({ ...base, paidAt: "01/11/2026" }).success).toBe(false);
    expect(paymentSchema.safeParse({ ...base, months: "25" }).success).toBe(false);
  });
});

describe("discountSchema", () => {
  const orgId = "6f1d2c1e-3b0a-4c9e-9a64-2f0f6a1b2c3d";

  it("maps each kind to the matching column and clears the other", () => {
    expect(discountSchema.parse({ orgId, kind: "none", value: "", until: "" })).toEqual({
      orgId,
      pct: null,
      cents: null,
      until: null,
    });
    expect(discountSchema.parse({ orgId, kind: "pct", value: "15", until: "2026-12-31" })).toEqual({
      orgId,
      pct: 15,
      cents: null,
      until: "2026-12-31",
    });
    expect(discountSchema.parse({ orgId, kind: "cents", value: "2.500", until: "" })).toEqual({
      orgId,
      pct: null,
      cents: 250_000,
      until: null,
    });
  });

  it("rejects a percentage out of range or a zero amount", () => {
    expect(discountSchema.safeParse({ orgId, kind: "pct", value: "120", until: "" }).success).toBe(false);
    expect(discountSchema.safeParse({ orgId, kind: "cents", value: "0", until: "" }).success).toBe(false);
  });
});
