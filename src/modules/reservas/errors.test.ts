import { describe, expect, it } from "vitest";

import { bookingErrorCode } from "./errors";

describe("bookingErrorCode", () => {
  it("maps the overlap constraint by SQLSTATE", () => {
    expect(bookingErrorCode({ code: "23P01", message: 'conflicting key value violates exclusion constraint "bookings_no_overlap"' })).toBe(
      "superpuesta",
    );
  });

  it("maps the database's stable codes", () => {
    expect(bookingErrorCode({ code: "P0001", message: "capacity_exceeded" })).toBe("capacidad");
    expect(bookingErrorCode({ code: "P0001", message: "no_unit_available" })).toBe("sin_unidad");
    expect(bookingErrorCode({ code: "P0001", message: "provisional_expired" })).toBe("vencida");
    expect(bookingErrorCode({ code: "P0001", message: "invalid_transition" })).toBe("transicion");
    expect(bookingErrorCode({ code: "P0001", message: "invalid_dates" })).toBe("fechas");
  });

  it("asks to retry when two concurrent writes aborted each other (deadlock or serialization failure)", () => {
    expect(bookingErrorCode({ code: "40P01", message: "deadlock detected" })).toBe("reintentar");
    expect(bookingErrorCode({ code: "40001", message: "could not serialize access" })).toBe("reintentar");
  });

  it("falls back to a generic write error", () => {
    expect(bookingErrorCode({ code: "42501", message: "new row violates row-level security policy" })).toBe("escritura");
    expect(bookingErrorCode({ code: "P0001", message: "unit_not_found" })).toBe("escritura");
  });
});
