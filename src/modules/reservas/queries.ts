import "server-only";

import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

import { addDays, type GridBooking, type ISODate } from "./calendar";

type Tables = Database["public"]["Tables"];
export type Booking = Tables["bookings"]["Row"];
export type Guest = Tables["guests"]["Row"];

// Reads filter by the caller's organization (from the membership) on top of RLS.

// Largest cleaning buffer a property may have (D25): a stay that ended this many days before the
// range can still show cleaning days inside it.
const MAX_BUFFER_DAYS = 30;

export type PropertyOption = { id: string; name: string; timezone: string };

export async function listPropertyOptions(orgId: string): Promise<PropertyOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("properties").select("id, name, timezone").eq("org_id", orgId).order("created_at");
  if (error) throw new Error("Could not load properties");
  return data;
}

export type CalendarUnit = { id: string; name: string; categoryId: string | null; maxGuests: number };
export type CalendarCategory = { id: string; name: string };

export type CalendarData = {
  units: CalendarUnit[];
  categories: CalendarCategory[];
  bookings: GridBooking[];
};

export async function getCalendar(orgId: string, propertyId: string, from: ISODate, to: ISODate): Promise<CalendarData> {
  const supabase = await createClient();
  const [{ units, categories }, bookingRes] = await Promise.all([
    listBookableUnits(orgId, propertyId),
    supabase
      .from("bookings")
      .select("id, unit_id, check_in, check_out, cleaning_buffer_days, status, kind, expires_at, notes, guests(full_name)")
      .eq("org_id", orgId)
      .eq("property_id", propertyId)
      .not("status", "in", "(cancelled,expired)")
      .lt("check_in", to)
      .gt("check_out", addDays(from, -MAX_BUFFER_DAYS)),
  ]);
  if (bookingRes.error) throw new Error("Could not load the calendar");
  return {
    units,
    categories,
    bookings: bookingRes.data.map((b) => ({
      id: b.id,
      unitId: b.unit_id,
      checkIn: b.check_in,
      checkOut: b.check_out,
      cleaningBufferDays: b.cleaning_buffer_days,
      status: b.status,
      kind: b.kind,
      expiresAt: b.expires_at,
      label: b.kind === "block" ? b.notes || "Bloqueo" : (b.guests?.full_name ?? "Reserva"),
    })),
  };
}

/** Units and categories a booking form can target. */
export async function listBookableUnits(orgId: string, propertyId: string): Promise<Omit<CalendarData, "bookings">> {
  const supabase = await createClient();
  const [unitRes, catRes] = await Promise.all([
    supabase
      .from("units")
      .select("id, name, category_id, max_guests")
      .eq("org_id", orgId)
      .eq("property_id", propertyId)
      .order("sort")
      .order("name"),
    supabase.from("unit_categories").select("id, name").eq("org_id", orgId).eq("property_id", propertyId).order("name"),
  ]);
  if (unitRes.error || catRes.error) throw new Error("Could not load the units");
  return {
    units: unitRes.data.map((u) => ({ id: u.id, name: u.name, categoryId: u.category_id, maxGuests: u.max_guests })),
    categories: catRes.data,
  };
}

export type BookingDetail = {
  booking: Booking;
  guest: Guest | null;
  property: PropertyOption;
  unitName: string;
  units: CalendarUnit[];
};

export async function getBooking(orgId: string, bookingId: string): Promise<BookingDetail | null> {
  const supabase = await createClient();
  const { data: booking, error } = await supabase.from("bookings").select("*").eq("org_id", orgId).eq("id", bookingId).maybeSingle();
  if (error) throw new Error("Could not load the booking");
  if (!booking) return null;

  const [guestRes, propRes, unitRes] = await Promise.all([
    booking.guest_id
      ? supabase.from("guests").select("*").eq("org_id", orgId).eq("id", booking.guest_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("properties").select("id, name, timezone").eq("org_id", orgId).eq("id", booking.property_id).single(),
    supabase
      .from("units")
      .select("id, name, category_id, max_guests")
      .eq("org_id", orgId)
      .eq("property_id", booking.property_id)
      .order("sort")
      .order("name"),
  ]);
  if (guestRes.error || propRes.error || unitRes.error) throw new Error("Could not load the booking");
  const units = unitRes.data.map((u) => ({ id: u.id, name: u.name, categoryId: u.category_id, maxGuests: u.max_guests }));
  return {
    booking,
    guest: guestRes.data,
    property: propRes.data,
    unitName: units.find((u) => u.id === booking.unit_id)?.name ?? "",
    units,
  };
}

export type OrgBookingRow = {
  id: string;
  kind: Database["public"]["Enums"]["booking_kind"];
  status: Database["public"]["Enums"]["booking_status"];
  checkIn: ISODate;
  checkOut: ISODate;
  propertyName: string;
  unitName: string;
  guestName: string | null;
  totalCents: number | null;
  currency: string;
};

/** The latest stays and blocks of one organization, newest check-in first (platform admin view). */
export async function listOrgBookings(orgId: string, limit = 100): Promise<OrgBookingRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("id, kind, status, check_in, check_out, total_cents, currency, properties(name), units(name), guests(full_name)")
    .eq("org_id", orgId)
    .order("check_in", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Could not load the bookings");
  return data.map((b) => ({
    id: b.id,
    kind: b.kind,
    status: b.status,
    checkIn: b.check_in,
    checkOut: b.check_out,
    propertyName: b.properties?.name ?? "",
    unitName: b.units?.name ?? "",
    guestName: b.guests?.full_name ?? null,
    totalCents: b.total_cents,
    currency: b.currency,
  }));
}
