import { describe, expect, it } from "vitest";

import {
  addDays,
  formatDate,
  isISODate,
  nights,
  occupancyGrid,
  todayIn,
  viewRange,
  weekdayShort,
  type GridBooking,
} from "./calendar";

describe("dates", () => {
  it("validates real calendar dates only", () => {
    expect(isISODate("2030-02-28")).toBe(true);
    expect(isISODate("2030-02-30")).toBe(false);
    expect(isISODate("2030-2-3")).toBe(false);
    expect(isISODate("")).toBe(false);
  });

  it("adds days across months and years", () => {
    expect(addDays("2030-01-31", 1)).toBe("2030-02-01");
    expect(addDays("2030-12-31", 1)).toBe("2031-01-01");
    expect(addDays("2030-03-01", -1)).toBe("2030-02-28");
  });

  it("counts nights with an exclusive check-out (10 → 13 is 3 nights)", () => {
    expect(nights("2030-01-10", "2030-01-13")).toBe(3);
  });

  it("formats dates for display in Spanish", () => {
    expect(formatDate("2030-01-07")).toBe("07/01/2030");
    expect(weekdayShort("2030-01-07")).toBe("lun");
    expect(weekdayShort("2030-01-13")).toBe("dom");
  });

  it("gives today's date in the property's time zone", () => {
    // 02:00 UTC on the 2nd is still the 1st in Buenos Aires (UTC-3).
    expect(todayIn("America/Argentina/Buenos_Aires", new Date("2030-05-02T02:00:00Z"))).toBe("2030-05-01");
  });
});

describe("viewRange", () => {
  it("week view starts on Monday and holds 7 days", () => {
    const r = viewRange("semana", "2030-01-10"); // Thursday
    expect(r.days).toEqual(["2030-01-07", "2030-01-08", "2030-01-09", "2030-01-10", "2030-01-11", "2030-01-12", "2030-01-13"]);
    expect(r).toMatchObject({ from: "2030-01-07", to: "2030-01-14", prev: "2029-12-31", next: "2030-01-14" });
  });

  it("month view covers the whole month", () => {
    const r = viewRange("mes", "2030-02-15");
    expect(r.days).toHaveLength(28);
    expect(r).toMatchObject({ from: "2030-02-01", to: "2030-03-01", prev: "2030-01-01", next: "2030-03-01" });
  });
});

describe("occupancyGrid", () => {
  const days = viewRange("semana", "2030-01-10").days; // 7 → 13
  const base: Omit<GridBooking, "id" | "checkIn" | "checkOut"> = {
    unitId: "u1",
    status: "confirmed",
    kind: "booking",
    cleaningBufferDays: 0,
    expiresAt: null,
    label: "Ana",
  };

  it("marks occupied nights, the first night and the cleaning days after check-out", () => {
    const grid = occupancyGrid(["u1"], [{ ...base, id: "b1", checkIn: "2030-01-08", checkOut: "2030-01-10", cleaningBufferDays: 1 }], days, new Date());
    expect(grid.get("u1")!.map((c) => (c.kind === "free" ? "." : c.kind === "stay" ? (c.starts ? "S" : "s") : "c"))).toEqual([
      ".", "S", "s", "c", ".", ".", ".",
    ]);
  });

  it("leaves out cancelled, expired and provisional bookings whose hold ran out", () => {
    const now = new Date("2030-01-01T12:00:00Z");
    const grid = occupancyGrid(
      ["u1"],
      [
        { ...base, id: "a", checkIn: "2030-01-07", checkOut: "2030-01-08", status: "cancelled" },
        { ...base, id: "b", checkIn: "2030-01-08", checkOut: "2030-01-09", status: "expired" },
        { ...base, id: "c", checkIn: "2030-01-09", checkOut: "2030-01-10", status: "provisional", expiresAt: "2030-01-01T11:00:00Z" },
        { ...base, id: "d", checkIn: "2030-01-10", checkOut: "2030-01-11", status: "provisional", expiresAt: "2030-01-01T13:00:00Z" },
      ],
      days,
      now,
    );
    expect(grid.get("u1")!.map((c) => (c.kind === "stay" ? c.booking.id : "."))).toEqual([".", ".", ".", "d", ".", ".", "."]);
  });

  it("marks a stay that began before the range as continuing, and keeps units apart", () => {
    const grid = occupancyGrid(["u1", "u2"], [{ ...base, id: "b1", checkIn: "2030-01-05", checkOut: "2030-01-08" }], days, new Date());
    const first = grid.get("u1")![0];
    expect(first.kind === "stay" && first.starts).toBe(false);
    expect(grid.get("u2")!.every((c) => c.kind === "free")).toBe(true);
  });
});
