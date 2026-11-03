"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireActiveMembership } from "@/modules/organizaciones/session";

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

export async function createBookingAction(formData: FormData): Promise<void> {
  await requireActiveMembership();
  const parsed = bookingSchema.safeParse(fields(formData));
  if (!parsed.success) done(NEW, { error: "datos_invalidos" }, back(formData));
  const b = parsed.data;
  const guest = { p_guest_name: b.guestName, p_guest_phone: b.guestPhone ?? undefined, p_guest_email: b.guestEmail ?? undefined };

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
  done(detailPath(data), { ok: "creada" });
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
    .select("id");
  if (error) done(detailPath(bookingId), { error: bookingErrorCode(error) });
  if (!data?.length) done(detailPath(bookingId), { error: "escritura" });
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
  done(detailPath(m.bookingId), { ok: "movida" });
}
