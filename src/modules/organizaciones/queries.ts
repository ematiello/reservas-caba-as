import "server-only";

import { createClient } from "@/lib/supabase/server";

import type { OrgStatus } from "./panel-state";

export type AdminOrganization = {
  id: string;
  name: string;
  slug: string;
  status: OrgStatus;
  createdAt: string;
  approvedAt: string | null;
  ownerName: string;
};

// Platform-admin view of every organization. RLS (`is_platform_admin()`) is what allows this read;
// callers must still be gated by `requirePlatformAdmin()`.
export async function listOrganizationsForAdmin(): Promise<AdminOrganization[]> {
  const supabase = await createClient();

  const { data: orgs, error } = await supabase
    .from("organizations")
    .select("id, name, slug, status, created_at, approved_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not load organizations");
  if (!orgs.length) return [];

  const { data: owners } = await supabase
    .from("memberships")
    .select("org_id, user_id")
    .eq("role", "owner")
    .in("org_id", orgs.map((o) => o.id));
  const userIds = [...new Set((owners ?? []).map((o) => o.user_id))];
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds)
    : { data: [] };

  const nameByUser = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name]));
  const ownerByOrg = new Map((owners ?? []).map((o) => [o.org_id, nameByUser.get(o.user_id) ?? ""]));

  return orgs.map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    status: o.status,
    createdAt: o.created_at,
    approvedAt: o.approved_at,
    ownerName: ownerByOrg.get(o.id) || "—",
  }));
}
