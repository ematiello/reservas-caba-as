import "server-only";

import { isOrgAccessActive } from "@/modules/suscripciones/queries";

import type { MemberRole, OrgMembership } from "./panel-state";

/** Owners and admins manage the organization's setup; operators only work the calendar (fixed roles). */
export function canManage(role: MemberRole): boolean {
  return role === "owner" || role === "admin";
}

/**
 * What the panel may offer this member: writes need a live subscription (invariant 6), and editing
 * the setup also needs a manager role. RLS enforces the same rules; this only shapes the UI.
 */
export async function writeAccess(org: Pick<OrgMembership, "orgId" | "role">): Promise<{ writable: boolean; canEdit: boolean }> {
  const writable = await isOrgAccessActive(org.orgId);
  return { writable, canEdit: writable && canManage(org.role) };
}
