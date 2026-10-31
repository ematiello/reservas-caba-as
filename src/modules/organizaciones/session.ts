import "server-only";

import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

import { resolvePanelState, type OrgMembership, type PanelState } from "./panel-state";

export type Access = {
  user: { id: string; email: string };
  isPlatformAdmin: boolean;
  memberships: OrgMembership[];
};

// Data access layer: every private page calls this itself. The proxy only refreshes the session and
// layouts do not re-run on client navigation, so neither can be the place that authorizes.
// `getUser()` validates the token with the Auth server; RLS limits what each query returns.
export const getAccess = cache(async (): Promise<Access | null> => {
  // The Supabase auth client reads Date.now() when it initializes: opt into request time first.
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;

  const [admin, memberships] = await Promise.all([
    supabase.from("platform_admins").select("user_id").maybeSingle(),
    // A platform admin can read every membership through RLS, so filter to the caller's own.
    supabase
      .from("memberships")
      .select("role, organizations(id, name, slug, status)")
      .eq("user_id", user.id)
      .order("created_at"),
  ]);

  const rows: OrgMembership[] = (memberships.data ?? []).flatMap((row) =>
    row.organizations
      ? [
          {
            orgId: row.organizations.id,
            orgName: row.organizations.name,
            slug: row.organizations.slug,
            status: row.organizations.status,
            role: row.role,
          },
        ]
      : [],
  );

  return {
    user: { id: user.id, email: user.email ?? "" },
    isPlatformAdmin: Boolean(admin.data),
    memberships: rows,
  };
});

function loginUrl(next: string) {
  return `/auth/login?next=${encodeURIComponent(next)}`;
}

export async function requireUser(next: string): Promise<Access> {
  const access = await getAccess();
  if (!access) redirect(loginUrl(next));
  return access;
}

// The owner area: signed in, then the screen that matches the organization's status.
export async function requirePanelAccess(): Promise<{ access: Access; state: PanelState }> {
  const access = await requireUser("/panel");
  return { access, state: resolvePanelState(access.memberships) };
}

// Team management: the owner of an active organization. Anyone else goes back to /panel.
// The organization always comes from the caller's own memberships, never from form input.
export async function requireOwnerAccess(): Promise<{ access: Access; org: OrgMembership }> {
  const { access, state } = await requirePanelAccess();
  if (state.kind !== "active" || state.membership.role !== "owner") redirect("/panel");
  return { access, org: state.membership };
}

// Superadmin area. A signed-in user who is not a platform admin gets a 404 so the route is not revealed.
export async function requirePlatformAdmin(): Promise<Access> {
  const access = await requireUser("/admin");
  if (!access.isPlatformAdmin) notFound();
  return access;
}
