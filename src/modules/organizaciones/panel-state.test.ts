import { describe, expect, it } from "vitest";

import { resolvePanelState, type OrgMembership } from "./panel-state";

const m = (status: OrgMembership["status"], id: string = status): OrgMembership => ({
  orgId: id,
  orgName: `Org ${id}`,
  slug: `org-${id}`,
  status,
  role: "owner",
});

describe("resolvePanelState", () => {
  it("asks to create a business when the user has no memberships", () => {
    expect(resolvePanelState([])).toEqual({ kind: "no_org" });
  });

  it("returns pending for a single pending organization", () => {
    const pending = m("pending_approval");
    expect(resolvePanelState([pending])).toEqual({ kind: "pending", membership: pending });
  });

  it("returns rejected for a single rejected organization", () => {
    const rejected = m("rejected");
    expect(resolvePanelState([rejected])).toEqual({ kind: "rejected", membership: rejected });
  });

  it("returns active for an active organization", () => {
    const active = m("active");
    expect(resolvePanelState([active])).toEqual({ kind: "active", membership: active });
  });

  it("prefers the first active organization over pending or rejected ones", () => {
    const pending = m("pending_approval", "p");
    const rejected = m("rejected", "r");
    const first = m("active", "a1");
    const second = m("active", "a2");
    expect(resolvePanelState([pending, rejected, first, second])).toEqual({ kind: "active", membership: first });
  });

  it("prefers pending over rejected", () => {
    const rejected = m("rejected", "r");
    const pending = m("pending_approval", "p");
    expect(resolvePanelState([rejected, pending])).toEqual({ kind: "pending", membership: pending });
  });
});
