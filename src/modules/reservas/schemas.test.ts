import { describe, expect, it } from "vitest";

import { blockSchema, bookingSchema, moveSchema, statusSchema } from "./schemas";

const UNIT = "11111111-1111-4111-8111-111111111111";
const CAT = "22222222-2222-4222-8222-222222222222";

const valid = {
  target: `unit:${UNIT}`,
  checkIn: "2030-01-10",
  checkOut: "2030-01-13",
  guestsCount: "2",
  guestName: " Ana Pérez ",
  guestPhone: "",
  guestEmail: "",
  status: "provisional",
  notes: "",
};

describe("bookingSchema", () => {
  it("parses a booking for a unit", () => {
    expect(bookingSchema.parse(valid)).toMatchObject({
      target: { kind: "unit", id: UNIT },
      checkIn: "2030-01-10",
      checkOut: "2030-01-13",
      guestsCount: 2,
      guestName: "Ana Pérez",
      guestPhone: null,
      guestEmail: null,
      status: "provisional",
    });
  });

  it("parses a booking for a category", () => {
    expect(bookingSchema.parse({ ...valid, target: `category:${CAT}` }).target).toEqual({ kind: "category", id: CAT });
  });

  it("rejects a check-out on or before the check-in, and impossible dates", () => {
    expect(bookingSchema.safeParse({ ...valid, checkOut: "2030-01-10" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...valid, checkIn: "2030-02-30" }).success).toBe(false);
  });

  it("requires a guest name and a guest count, and rejects other targets and states", () => {
    expect(bookingSchema.safeParse({ ...valid, guestName: "  " }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...valid, guestsCount: "0" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...valid, target: "unit:nope" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...valid, status: "checked_in" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...valid, guestEmail: "no-es-email" }).success).toBe(false);
  });
});

describe("blockSchema", () => {
  it("parses a block on a unit", () => {
    expect(blockSchema.parse({ unitId: UNIT, checkIn: "2030-01-10", checkOut: "2030-01-11", notes: "Pintura" })).toEqual({
      unitId: UNIT,
      checkIn: "2030-01-10",
      checkOut: "2030-01-11",
      notes: "Pintura",
    });
  });
});

describe("statusSchema and moveSchema", () => {
  it("only accepts the states a user moves a booking to", () => {
    for (const s of ["confirmed", "checked_in", "checked_out", "cancelled"]) {
      expect(statusSchema.safeParse({ bookingId: UNIT, status: s }).success, s).toBe(true);
    }
    expect(statusSchema.safeParse({ bookingId: UNIT, status: "expired" }).success).toBe(false);
  });

  it("parses a move with new dates", () => {
    expect(moveSchema.parse({ bookingId: CAT, unitId: UNIT, checkIn: "2030-01-10", checkOut: "2030-01-12", guestsCount: "3" })).toMatchObject({
      unitId: UNIT,
      guestsCount: 3,
    });
  });

  it("moves a block without a guest count (blocks hold no guests)", () => {
    const parsed = moveSchema.parse({ bookingId: CAT, unitId: UNIT, checkIn: "2030-01-10", checkOut: "2030-01-12" });
    expect(parsed.guestsCount).toBeUndefined();
  });
});
