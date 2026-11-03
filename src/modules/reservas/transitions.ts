import type { BookingKind, BookingStatus } from "./calendar";

/** Status changes a member can request from the panel (expiring is pg_cron's job). */
export type ManualTarget = Extract<BookingStatus, "confirmed" | "checked_in" | "checked_out" | "cancelled">;

export const MANUAL_TARGETS: readonly ManualTarget[] = ["confirmed", "checked_in", "checked_out", "cancelled"];

// Mirror of the transitions private.bookings_guard accepts. tests/db/bookings.test.ts checks every
// (status, kind, target) against the database, so a divergence fails a test instead of showing a
// button that ends in "invalid_transition".
const BOOKING: Record<BookingStatus, readonly ManualTarget[]> = {
  provisional: ["confirmed", "cancelled"],
  confirmed: ["checked_in", "cancelled"],
  checked_in: ["checked_out"],
  checked_out: [],
  cancelled: [],
  expired: [],
};

const BLOCK: Record<BookingStatus, readonly ManualTarget[]> = {
  provisional: [],
  confirmed: ["cancelled"],
  checked_in: [],
  checked_out: [],
  cancelled: [],
  expired: [],
};

export function allowedTargets(status: BookingStatus, kind: BookingKind): readonly ManualTarget[] {
  return (kind === "block" ? BLOCK : BOOKING)[status];
}
