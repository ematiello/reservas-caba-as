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
  disabledAt: string | null;
  ownerName: string;
};

export type TeamMember = { userId: string; fullName: string; role: "owner" | "admin" | "operator" };
export type PendingInvitation = { id: string; role: "admin" | "operator"; expiresAt: string };

// Members and open invitations of one organization. RLS limits members to the caller's own
// organizations and invitations to owners; callers are still gated by `requireOwnerAccess()`.
export async function getTeam(orgId: string): Promise<{ members: TeamMember[]; invitations: PendingInvitation[] }> {
  const supabase = await createClient();

  const [membersRes, invitationsRes] = await Promise.all([
    supabase.from("memberships").select("user_id, role").eq("org_id", orgId).order("created_at"),
    supabase
      .from("invitations")
      .select("id, role, expires_at")
      .eq("org_id", orgId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
  ]);
  if (membersRes.error || invitationsRes.error) throw new Error("Could not load the team");

  const ids = membersRes.data.map((m) => m.user_id);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("user_id, full_name").in("user_id", ids)
    : { data: [] };
  const names = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name]));

  return {
    members: membersRes.data.map((m) => ({ userId: m.user_id, fullName: names.get(m.user_id) || "—", role: m.role })),
    invitations: invitationsRes.data.map((i) => ({
      id: i.id,
      role: i.role as PendingInvitation["role"],
      expiresAt: i.expires_at,
    })),
  };
}

// Platform-admin view of every organization. RLS (`is_platform_admin()`) is what allows this read;
// callers must still be gated by `requirePlatformAdmin()`.
export async function listOrganizationsForAdmin(): Promise<AdminOrganization[]> {
  const supabase = await createClient();

  const { data: orgs, error } = await supabase
    .from("organizations")
    .select("id, name, slug, status, created_at, approved_at, disabled_at")
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
    disabledAt: o.disabled_at,
    ownerName: ownerByOrg.get(o.id) || "—",
  }));
}
