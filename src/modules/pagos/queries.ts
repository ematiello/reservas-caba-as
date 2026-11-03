import "server-only";

import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export type GuestPayment = Pick<
  Database["public"]["Tables"]["booking_payments"]["Row"],
  "id" | "kind" | "method" | "amount_cents" | "paid_at" | "reference" | "voided_at"
>;

// Filtered by the caller's organization (from the membership) on top of RLS.
export async function listPayments(orgId: string, bookingId: string): Promise<GuestPayment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("booking_payments")
    .select("id, kind, method, amount_cents, paid_at, reference, voided_at")
    .eq("org_id", orgId)
    .eq("booking_id", bookingId)
    .order("paid_at")
    .order("created_at");
  if (error) throw new Error("Could not load the payments");
  return data;
}
