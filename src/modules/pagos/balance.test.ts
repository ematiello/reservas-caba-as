import { describe, expect, it } from "vitest";

import { balance, type PaymentLine } from "./balance";

const p = (kind: PaymentLine["kind"], amountCents: number, voided = false): PaymentLine => ({
  kind,
  amountCents,
  voidedAt: voided ? "2030-01-01T00:00:00Z" : null,
});

describe("balance", () => {
  it("is the total when nothing was paid", () => {
    expect(balance(100_000, [])).toEqual({ paidCents: 0, dueCents: 100_000 });
  });

  it("subtracts deposits and partial payments", () => {
    expect(balance(100_000, [p("deposit", 30_000), p("payment", 20_000)])).toEqual({ paidCents: 50_000, dueCents: 50_000 });
  });

  it("refunds give money back, so they raise what is due", () => {
    expect(balance(100_000, [p("payment", 100_000), p("refund", 10_000)])).toEqual({ paidCents: 90_000, dueCents: 10_000 });
  });

  it("ignores voided payments", () => {
    expect(balance(100_000, [p("deposit", 30_000, true), p("payment", 40_000)])).toEqual({ paidCents: 40_000, dueCents: 60_000 });
  });

  it("goes negative when the guest overpaid (money to return)", () => {
    expect(balance(100_000, [p("payment", 120_000)]).dueCents).toBe(-20_000);
  });

  it("has no due amount while the booking has no frozen price", () => {
    expect(balance(null, [p("deposit", 30_000)])).toEqual({ paidCents: 30_000, dueCents: null });
  });
});
