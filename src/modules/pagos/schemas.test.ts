import { describe, expect, it } from "vitest";

import { depositSchema, guestPaymentSchema, voidSchema } from "./schemas";

const B = "11111111-1111-4111-8111-111111111111";
const P = "22222222-2222-4222-8222-222222222222";

describe("guestPaymentSchema", () => {
  const valid = { bookingId: B, kind: "deposit", method: "transfer", amount: "15.000,50", paidOn: "2030-01-10", reference: " op 123 " };

  it("parses pesos typed in es-AR into integer cents", () => {
    expect(guestPaymentSchema.parse(valid)).toEqual({
      bookingId: B,
      kind: "deposit",
      method: "transfer",
      amountCents: 1_500_050,
      paidOn: "2030-01-10",
      reference: "op 123",
    });
  });

  it("rejects zero, negative or malformed amounts, unknown kinds and methods, and bad dates", () => {
    for (const amount of ["0", "-5", "abc", "", "1,234"]) {
      expect(guestPaymentSchema.safeParse({ ...valid, amount }).success, amount).toBe(false);
    }
    expect(guestPaymentSchema.safeParse({ ...valid, kind: "gift" }).success).toBe(false);
    expect(guestPaymentSchema.safeParse({ ...valid, method: "crypto" }).success).toBe(false);
    expect(guestPaymentSchema.safeParse({ ...valid, paidOn: "2030-02-30" }).success).toBe(false);
  });
});

describe("depositSchema and voidSchema", () => {
  it("accepts a deposit of zero and parses it to cents", () => {
    expect(depositSchema.parse({ bookingId: B, deposit: "0" })).toEqual({ bookingId: B, depositCents: 0 });
    expect(depositSchema.parse({ bookingId: B, deposit: "9.000" })).toEqual({ bookingId: B, depositCents: 900_000 });
    expect(depositSchema.safeParse({ bookingId: B, deposit: "-1" }).success).toBe(false);
  });

  it("needs both ids to void", () => {
    expect(voidSchema.parse({ bookingId: B, paymentId: P })).toEqual({ bookingId: B, paymentId: P });
    expect(voidSchema.safeParse({ bookingId: B, paymentId: "x" }).success).toBe(false);
  });
});
