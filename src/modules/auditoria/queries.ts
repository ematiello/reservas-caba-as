import "server-only";

import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export type AuditEntry = Database["public"]["Functions"]["audit_entries"]["Returns"][number];

export const AUDIT_PAGE = 50;

/**
 * One organization's log (its owner or the platform admin) or, with orgId null, every
 * organization's (platform admin). The database decides who may read it (audit_entries).
 */
export async function listAuditEntries(orgId: string | null, before?: number): Promise<AuditEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("audit_entries", {
    ...(orgId ? { p_org: orgId } : {}),
    ...(before ? { p_before: before } : {}),
    p_limit: AUDIT_PAGE,
  });
  if (error) throw new Error("Could not load the audit log");
  return data;
}

/** Positive integer cursor from ?antes=, or undefined. */
export function cursorFrom(value: string | string[] | undefined): number | undefined {
  return typeof value === "string" && /^\d{1,18}$/.test(value) ? Number(value) : undefined;
}

/**
 * Records that the platform admin opened an organization's bookings or guests. Fails closed: if the
 * audit row cannot be written, the page does not render the data.
 */
export async function logAdminAccess(orgId: string, area: "bookings" | "guests"): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("log_admin_access", { p_org: orgId, p_area: area });
  if (error) throw new Error("Could not record the access");
}

export type PlatformAdmin = Database["public"]["Functions"]["list_platform_admins"]["Returns"][number];

export async function listPlatformAdmins(): Promise<PlatformAdmin[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_platform_admins");
  if (error) throw new Error("Could not load the platform admins");
  return data;
}
