import { describe, expect, it } from "vitest";

import { amountDue, formatArs } from "./billing";

const none = { pct: null, cents: null, until: null };

describe("amountDue", () => {
  it("charges the plan price without a discount", () => {
    expect(amountDue(1_000_000, none, "2026-11-01")).toBe(1_000_000);
  });

  it("applies a percentage discount, rounded to whole cents", () => {
    expect(amountDue(1_000_000, { pct: 15, cents: null, until: null }, "2026-11-01")).toBe(850_000);
    expect(amountDue(999, { pct: 12.5, cents: null, until: null }, "2026-11-01")).toBe(874);
  });

  it("applies a fixed amount discount, never below zero", () => {
    expect(amountDue(1_000_000, { pct: null, cents: 250_000, until: null }, "2026-11-01")).toBe(750_000);
    expect(amountDue(1_000_000, { pct: null, cents: 2_000_000, until: null }, "2026-11-01")).toBe(0);
  });

  it("keeps the discount through its last day and drops it afterwards", () => {
    const discount = { pct: 50, cents: null, until: "2026-11-30" };
    expect(amountDue(1_000_000, discount, "2026-11-30")).toBe(500_000);
    expect(amountDue(1_000_000, discount, "2026-12-01")).toBe(1_000_000);
  });
});

describe("formatArs", () => {
  it("formats cents as Argentine pesos", () => {
    expect(formatArs(1_234_550)).toMatch(/^\$\s?12\.345,50$/);
  });
});
