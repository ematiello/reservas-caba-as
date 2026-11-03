"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { writeAccess } from "@/modules/organizaciones/access";
import { requireActiveMembership } from "@/modules/organizaciones/session";
import type { PricingResult } from "@/modules/tarifas/pricing";
import { clearFrozenPrice, quoteStay, type Stay, writeFrozenPrice } from "@/modules/tarifas/server";

import { bookingErrorCode } from "./errors";
import { blockSchema, bookingSchema, moveSchema, statusSchema } from "./schemas";

// Every role (owner, admin, operator) works the calendar (docs/01). The organization comes from
// the caller's membership; RLS checks membership and a live subscription again, and the database
// enforces overlaps, capacity, expiry and state transitions. Results travel as ?ok= / ?error=.

const LIST = "/panel/reservas";
const NEW = `${LIST}/nueva`;
const detailPath = (id: string) => `${LIST}/${id}`;

function fields(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) if (typeof value === "string") out[key] = value;
  return out;
}

function done(path: string, result: { ok: string } | { error: string }, keep: Record<string, string> = {}): never {
  revalidatePath(LIST, "layout");
  const params = new URLSearchParams(keep);
  if ("ok" in result) params.set("ok", result.ok);
  else params.set("error", result.error);
  redirect(`${path}?${params}`);
}

// Where to go back to after a failed form: the same property and day.
function back(formData: FormData): Record<string, string> {
  const keep: Record<string, string> = {};
  const property = formData.get("propertyId");
  const day = formData.get("checkIn");
  if (typeof property === "string" && z.uuid().safeParse(property).success) keep.property = property;
  if (typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day)) keep.fecha = day;
  return keep;
}

// Pricing must never block the calendar: if the rates cannot be read, the booking is kept without a
// price and its page offers to compute it again.
async function tryQuote(orgId: string, stay: Stay): Promise<PricingResult | null> {
  try {
    return await quoteStay(orgId, stay);
  } catch {
    return null;
  }
}

// The rates' minimum stay rejects the stay before anything is written (docs/01).
function minNightsError(result: PricingResult, keep: Record<string, string>) {
  return result.ok || result.error !== "min_nights" ? null : { error: "estadia_minima", keep: { ...keep, minimo: String(result.minNights) } };
}

export async function createBookingAction(formData: FormData): Promise<void> {
  const { org } = await requireActiveMembership();
  const parsed = bookingSchema.safeParse(fields(formData));
  if (!parsed.success) done(NEW, { error: "datos_invalidos" }, back(formData));
  const b = parsed.data;
  const guest = { p_guest_name: b.guestName, p_guest_phone: b.guestPhone ?? undefined, p_guest_email: b.guestEmail ?? undefined };
  const stay = { checkIn: b.checkIn, checkOut: b.checkOut, guests: b.guestsCount };

  // By unit the price is known before booking; by category, once a unit is assigned.
  let price = b.target.kind === "unit" ? await tryQuote(org.orgId, { unitId: b.target.id, ...stay }) : null;
  const early = price && minNightsError(price, back(formData));
  if (early) done(NEW, { error: early.error }, early.keep);

  const supabase = await createClient();
  const { data, error } =
    b.target.kind === "unit"
      ? await supabase.rpc("create_booking", {
          p_unit: b.target.id,
          p_check_in: b.checkIn,
          p_check_out: b.checkOut,
          p_kind: "booking",
          p_status: b.status,
          p_guests_count: b.guestsCount,
          p_notes: b.notes,
          ...guest,
        })
      : await supabase.rpc("create_booking_for_category", {
          p_category: b.target.id,
          p_check_in: b.checkIn,
          p_check_out: b.checkOut,
          p_status: b.status,
          p_guests_count: b.guestsCount,
          p_notes: b.notes,
          ...guest,
        });
  if (error || !data) done(NEW, { error: error ? bookingErrorCode(error) : "escritura" }, back(formData));

  if (!price) {
    const { data: row } = await supabase.from("bookings").select("unit_id").eq("org_id", org.orgId).eq("id", data).single();
    price = row ? await tryQuote(org.orgId, { unitId: row.unit_id, ...stay }) : null;
    const late = price && minNightsError(price, back(formData));
    if (late) {
      // The unit's rates reject the stay: release the dates again. If that fails, the booking still
      // holds the dates, so send the user to it instead of reporting a booking that does not exist.
      const cancelled = await supabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("org_id", org.orgId)
        .eq("id", data)
        .select("id");
      if (cancelled.error || cancelled.data?.length !== 1) done(detailPath(data), { error: "minimo_sin_anular" });
      done(NEW, { error: late.error }, late.keep);
    }
  }
  // A failed write leaves the booking without a price; its page offers to compute it again.
  if (price) await writeFrozenPrice(org.orgId, data, price);
  done(detailPath(data), { ok: "creada" });
}

/** Computes and freezes the price of a booking that has none yet (no rates when it was made). */
export async function priceBookingAction(formData: FormData): Promise<void> {
  const { org } = await requireActiveMembership();
  const id = z.uuid().safeParse(formData.get("bookingId"));
  if (!id.success) redirect(LIST);
  // The write below uses service_role, which skips RLS: check the live subscription here.
  if (!(await writeAccess(org)).writable) done(detailPath(id.data), { error: "escritura" });
  const supabase = await createClient();
  const { data: b } = await supabase
    .from("bookings")
    .select("unit_id, check_in, check_out, guests_count, kind, total_cents")
    .eq("org_id", org.orgId)
    .eq("id", id.data)
    .maybeSingle();
  if (!b || b.kind !== "booking" || b.guests_count === null) redirect(LIST);
  if (b.total_cents !== null) done(detailPath(id.data), { ok: "precio" });

  const price = await tryQuote(org.orgId, { unitId: b.unit_id, checkIn: b.check_in, checkOut: b.check_out, guests: b.guests_count });
  if (!price) done(detailPath(id.data), { error: "escritura" });
  if (!price.ok) done(detailPath(id.data), { error: price.error === "min_nights" ? "estadia_minima" : "sin_tarifa" });
  // A price frozen meanwhile (a concurrent confirm or move) wins over this one.
  if (!(await writeFrozenPrice(org.orgId, id.data, price, { onlyIfUnpriced: true }))) done(detailPath(id.data), { error: "escritura" });
  done(detailPath(id.data), { ok: "precio" });
}

export async function createBlockAction(formData: FormData): Promise<void> {
  await requireActiveMembership();
  const parsed = blockSchema.safeParse(fields(formData));
  if (!parsed.success) done(NEW, { error: "datos_invalidos" }, back(formData));
  const b = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_booking", {
    p_unit: b.unitId,
    p_check_in: b.checkIn,
    p_check_out: b.checkOut,
    p_kind: "block",
    p_notes: b.notes,
  });
  if (error || !data) done(NEW, { error: error ? bookingErrorCode(error) : "escritura" }, back(formData));
  done(detailPath(data), { ok: "bloqueo" });
}

export async function setBookingStatusAction(formData: FormData): Promise<void> {
  const { org } = await requireActiveMembership();
  const parsed = statusSchema.safeParse(fields(formData));
  if (!parsed.success) redirect(LIST);
  const { bookingId, status } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .update({ status })
    .eq("org_id", org.orgId)
    .eq("id", bookingId)
    .select("unit_id, check_in, check_out, guests_count, kind, total_cents");
  if (error) done(detailPath(bookingId), { error: bookingErrorCode(error) });
  const row = data?.[0];
  if (!row) done(detailPath(bookingId), { error: "escritura" });

  // Confirming freezes the price when the booking still has none (docs/01); a frozen one stays.
  if (status === "confirmed" && row.kind === "booking" && row.total_cents === null && row.guests_count !== null) {
    const price = await tryQuote(org.orgId, { unitId: row.unit_id, checkIn: row.check_in, checkOut: row.check_out, guests: row.guests_count });
    if (price) await writeFrozenPrice(org.orgId, bookingId, price, { onlyIfUnpriced: true });
  }
  done(detailPath(bookingId), { ok: status });
}

export async function moveBookingAction(formData: FormData): Promise<void> {
  const { org } = await requireActiveMembership();
  const parsed = moveSchema.safeParse(fields(formData));
  const id = z.uuid().safeParse(formData.get("bookingId"));
  if (!id.success) redirect(LIST);
  if (!parsed.success) done(detailPath(id.data), { error: "datos_invalidos" });
  const m = parsed.data;

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("bookings")
    .select("kind, guests_count")
    .eq("org_id", org.orgId)
    .eq("id", m.bookingId)
    .maybeSingle();
  if (!current) redirect(LIST);

  // A changed stay is another stay: it is priced again (and the rates' minimum checked first).
  const guests = m.guestsCount ?? current.guests_count;
  const price =
    current.kind === "booking" && guests !== null
      ? await tryQuote(org.orgId, { unitId: m.unitId, checkIn: m.checkIn, checkOut: m.checkOut, guests })
      : null;
  const early = price && minNightsError(price, {});
  if (early) done(detailPath(m.bookingId), { error: early.error }, early.keep);

  const { data, error } = await supabase
    .from("bookings")
    .update({
      unit_id: m.unitId,
      check_in: m.checkIn,
      check_out: m.checkOut,
      ...(m.guestsCount === undefined ? {} : { guests_count: m.guestsCount }),
    })
    .eq("org_id", org.orgId)
    .eq("id", m.bookingId)
    .select("id");
  if (error) done(detailPath(m.bookingId), { error: bookingErrorCode(error) });
  if (!data?.length) done(detailPath(m.bookingId), { error: "escritura" });
  if (current.kind === "booking") {
    // The old price belongs to the old stay: when the new one cannot be priced, drop it (the page
    // then offers to compute it), and say so when even that write fails.
    const repriced = price ? await writeFrozenPrice(org.orgId, m.bookingId, price) : await clearFrozenPrice(org.orgId, m.bookingId);
    if (!repriced) done(detailPath(m.bookingId), { error: "precio_pendiente" });
  }
  done(detailPath(m.bookingId), { ok: "movida" });
}
