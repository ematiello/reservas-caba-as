import "server-only";

import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

import { searchTerm } from "./schemas";

// Reads filter by the caller's organization (from the membership) on top of RLS.

export type Guest = Database["public"]["Tables"]["guests"]["Row"];
export type GuestListItem = Pick<Guest, "id" | "full_name" | "phone" | "email"> & { bookings: number };

const PAGE = 50;

export async function listGuests(orgId: string, search: string | undefined): Promise<GuestListItem[]> {
  const supabase = await createClient();
  let query = supabase.from("guests").select("id, full_name, phone, email, bookings(count)").eq("org_id", orgId);
  const term = searchTerm(search);
  if (term) query = query.or(`full_name.ilike.*${term}*,phone.ilike.*${term}*,email.ilike.*${term}*`);
  const { data, error } = await query.order("full_name").limit(PAGE);
  if (error) throw new Error("Could not load the guests");
  return data.map(({ bookings, ...g }) => ({ ...g, bookings: bookings[0]?.count ?? 0 }));
}

export type GuestStay = {
  id: string;
  checkIn: string;
  checkOut: string;
  status: Database["public"]["Enums"]["booking_status"];
  unitName: string;
  totalCents: number | null;
};

export async function getGuest(orgId: string, guestId: string): Promise<{ guest: Guest; stays: GuestStay[] } | null> {
  const supabase = await createClient();
  const [guestRes, staysRes] = await Promise.all([
    supabase.from("guests").select("*").eq("org_id", orgId).eq("id", guestId).maybeSingle(),
    supabase
      .from("bookings")
      .select("id, check_in, check_out, status, total_cents, units(name)")
      .eq("org_id", orgId)
      .eq("guest_id", guestId)
      .order("check_in", { ascending: false }),
  ]);
  if (guestRes.error || staysRes.error) throw new Error("Could not load the guest");
  if (!guestRes.data) return null;
  return {
    guest: guestRes.data,
    stays: staysRes.data.map((b) => ({
      id: b.id,
      checkIn: b.check_in,
      checkOut: b.check_out,
      status: b.status,
      unitName: b.units?.name ?? "",
      totalCents: b.total_cents,
    })),
  };
}
