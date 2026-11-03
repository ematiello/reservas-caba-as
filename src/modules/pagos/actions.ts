"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { writeAccess } from "@/modules/organizaciones/access";
import { requireActiveMembership } from "@/modules/organizaciones/session";
import { writeDeposit } from "@/modules/tarifas/server";

import { depositSchema, guestPaymentSchema, voidSchema } from "./schemas";

// Guest payments, recorded by hand (no gateway). Any member records deposits and payments; refunds,
// voiding and adjusting the deposit are for owner or admin. RLS and the payment guard enforce the
// same rules; results travel back to the booking page as ?ok= / ?error=.

const detailPath = (id: string) => `/panel/reservas/${id}`;

function fields(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) if (typeof value === "string") out[key] = value;
  return out;
}

function done(bookingId: string, result: { ok: string } | { error: string }): never {
  revalidatePath("/panel/reservas", "layout");
  const params = new URLSearchParams("ok" in result ? { ok: result.ok } : { error: result.error });
  redirect(`${detailPath(bookingId)}?${params}#pagos`);
}

function bookingIdOf(formData: FormData): string {
  const id = z.uuid().safeParse(formData.get("bookingId"));
  if (!id.success) redirect("/panel/reservas");
  return id.data;
}

export async function recordPaymentAction(formData: FormData): Promise<void> {
  const { org } = await requireActiveMembership();
  const bookingId = bookingIdOf(formData);
  const parsed = guestPaymentSchema.safeParse(fields(formData));
  if (!parsed.success) done(bookingId, { error: "pago_invalido" });
  const p = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("booking_payments").insert({
    org_id: org.orgId,
    booking_id: p.bookingId,
    kind: p.kind,
    method: p.method,
    amount_cents: p.amountCents,
    // Midday UTC keeps the typed day in every Argentine time zone.
    paid_at: `${p.paidOn}T12:00:00Z`,
    reference: p.reference,
  });
  if (error) done(bookingId, { error: "pago_rechazado" });
  done(bookingId, { ok: p.kind === "refund" ? "devolucion" : "pago" });
}

export async function voidPaymentAction(formData: FormData): Promise<void> {
  const { org } = await requireActiveMembership();
  const bookingId = bookingIdOf(formData);
  const parsed = voidSchema.safeParse(fields(formData));
  if (!parsed.success) done(bookingId, { error: "pago_invalido" });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("booking_payments")
    .update({ voided_at: new Date().toISOString() })
    .eq("org_id", org.orgId)
    .eq("booking_id", parsed.data.bookingId)
    .eq("id", parsed.data.paymentId)
    .select("id");
  if (error || !data.length) done(bookingId, { error: "anulacion_rechazada" });
  done(bookingId, { ok: "anulado" });
}

export async function setDepositAction(formData: FormData): Promise<void> {
  const { org } = await requireActiveMembership();
  const bookingId = bookingIdOf(formData);
  // The deposit is written with service_role (amounts never come from a user session), which skips
  // RLS: role and live subscription are checked here, and the booking is read with the caller's own
  // session first so it must belong to their organization.
  if (!(await writeAccess(org)).canEdit) done(bookingId, { error: "sin_permiso" });
  const parsed = depositSchema.safeParse(fields(formData));
  if (!parsed.success) done(bookingId, { error: "sena_invalida" });

  const supabase = await createClient();
  const { data: booking } = await supabase.from("bookings").select("id").eq("org_id", org.orgId).eq("id", parsed.data.bookingId).maybeSingle();
  if (!booking) redirect("/panel/reservas");
  if (!(await writeDeposit(org.orgId, booking.id, parsed.data.depositCents))) done(bookingId, { error: "sena_invalida" });
  done(bookingId, { ok: "sena" });
}
