// Stays are local calendar dates ("YYYY-MM-DD") with an exclusive check-out: 10 → 13 occupies the
// nights of the 10th, 11th and 12th. Date math runs in UTC so no time zone shifts a day.

export type ISODate = string;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function toUTC(date: ISODate): Date {
  return new Date(`${date}T00:00:00Z`);
}

function fromUTC(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

/** A real calendar date in "YYYY-MM-DD" form (rejects 2030-02-30). */
export function isISODate(value: string): boolean {
  if (!ISO.test(value)) return false;
  const d = toUTC(value);
  return !Number.isNaN(d.getTime()) && fromUTC(d) === value;
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = toUTC(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUTC(d);
}

export function nights(checkIn: ISODate, checkOut: ISODate): number {
  return Math.round((toUTC(checkOut).getTime() - toUTC(checkIn).getTime()) / 86_400_000);
}

/** "07/01/2030" (day/month/year, as read in Argentina). */
export function formatDate(date: ISODate): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

export function weekdayShort(date: ISODate): string {
  return WEEKDAYS[toUTC(date).getUTCDay()];
}

/** Today's date where the property is, e.g. "America/Argentina/Buenos_Aires". */
export function todayIn(timeZone: string, now: Date = new Date()): ISODate {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export type ViewKind = "semana" | "mes";

export type ViewRange = { from: ISODate; to: ISODate; days: ISODate[]; prev: ISODate; next: ISODate };

/** Days shown by the calendar: a Monday-to-Sunday week, or a whole month. `to` is exclusive. */
export function viewRange(kind: ViewKind, anchor: ISODate): ViewRange {
  let from: ISODate;
  let to: ISODate;
  let prev: ISODate;
  if (kind === "semana") {
    const weekday = (toUTC(anchor).getUTCDay() + 6) % 7; // Monday = 0
    from = addDays(anchor, -weekday);
    to = addDays(from, 7);
    prev = addDays(from, -7);
  } else {
    from = `${anchor.slice(0, 7)}-01`;
    const d = toUTC(from);
    d.setUTCMonth(d.getUTCMonth() + 1);
    to = fromUTC(d);
    const p = toUTC(from);
    p.setUTCMonth(p.getUTCMonth() - 1);
    prev = fromUTC(p);
  }
  const days: ISODate[] = [];
  for (let day = from; day < to; day = addDays(day, 1)) days.push(day);
  return { from, to, days, prev, next: to };
}

export type BookingStatus = "provisional" | "confirmed" | "checked_in" | "checked_out" | "cancelled" | "expired";

export type GridBooking = {
  id: string;
  unitId: string;
  checkIn: ISODate;
  checkOut: ISODate;
  cleaningBufferDays: number;
  status: BookingStatus;
  kind: "booking" | "block";
  expiresAt: string | null;
  label: string;
};

export type Cell =
  | { kind: "free" }
  | { kind: "stay"; booking: GridBooking; starts: boolean }
  | { kind: "cleaning"; booking: GridBooking };

/** Same rule as the database: these states block, a provisional only until its hold runs out. */
export function blocksDates(b: Pick<GridBooking, "status" | "expiresAt">, now: Date): boolean {
  if (b.status === "cancelled" || b.status === "expired") return false;
  if (b.status === "provisional") return b.expiresAt !== null && new Date(b.expiresAt) > now;
  return true;
}

/** One row per unit, one cell per day: occupied night, cleaning day after check-out, or free. */
export function occupancyGrid(unitIds: string[], bookings: GridBooking[], days: ISODate[], now: Date): Map<string, Cell[]> {
  const grid = new Map<string, Cell[]>(unitIds.map((id) => [id, days.map(() => ({ kind: "free" }) as Cell)]));
  for (const b of bookings) {
    const row = grid.get(b.unitId);
    if (!row || !blocksDates(b, now)) continue;
    const cleaningEnd = addDays(b.checkOut, b.cleaningBufferDays);
    days.forEach((day, i) => {
      if (day >= b.checkIn && day < b.checkOut) row[i] = { kind: "stay", booking: b, starts: day === b.checkIn };
      else if (day >= b.checkOut && day < cleaningEnd) row[i] = { kind: "cleaning", booking: b };
    });
  }
  return grid;
}
