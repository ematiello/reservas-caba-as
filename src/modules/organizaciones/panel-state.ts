export type OrgStatus = "pending_approval" | "active" | "rejected";
export type MemberRole = "owner" | "admin" | "operator";

export type OrgMembership = {
  orgId: string;
  orgName: string;
  slug: string;
  status: OrgStatus;
  role: MemberRole;
};

export type PanelState =
  | { kind: "no_org" }
  | { kind: "pending" | "rejected" | "active"; membership: OrgMembership };

const KIND_BY_STATUS = { active: "active", pending_approval: "pending", rejected: "rejected" } as const;

// Which screen the owner area shows. Memberships come ordered by creation; the first match of the
// best status wins (active > pending > rejected). An organization switcher is a later concern.
export function resolvePanelState(memberships: readonly OrgMembership[]): PanelState {
  for (const status of ["active", "pending_approval", "rejected"] as const) {
    const membership = memberships.find((m) => m.status === status);
    if (membership) return { kind: KIND_BY_STATUS[status], membership };
  }
  return { kind: "no_org" };
}
