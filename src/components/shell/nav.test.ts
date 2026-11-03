import { describe, expect, it } from "vitest";

import type { MemberRole, OrgMembership, OrgStatus } from "@/modules/organizaciones/panel-state";

import { isActive, shellNavigation } from "./nav";

const member = (role: MemberRole, status: OrgStatus = "active"): OrgMembership => ({
  orgId: "o1",
  orgName: "Org",
  slug: "org",
  status,
  role,
});
const labels = (items: { label: string }[] | null) => items?.map((i) => i.label) ?? null;

describe("shellNavigation", () => {
  it("gives the owner every panel tab and no admin tabs", () => {
    const nav = shellNavigation({ isPlatformAdmin: false, memberships: [member("owner")] });
    expect(labels(nav.panel)).toEqual([
      "Inicio",
      "Reservas",
      "Huéspedes",
      "Alojamientos",
      "Feriados",
      "Equipo",
      "Suscripción",
      "Organización",
    ]);
    expect(nav.admin).toBeNull();
    expect(nav.home).toBe("/panel");
  });

  it("gives admins the holidays but not the owner-only tabs", () => {
    const nav = shellNavigation({ isPlatformAdmin: false, memberships: [member("admin")] });
    expect(labels(nav.panel)).toEqual(["Inicio", "Reservas", "Huéspedes", "Alojamientos", "Feriados"]);
  });

  it("gives operators only the daily work", () => {
    const nav = shellNavigation({ isPlatformAdmin: false, memberships: [member("operator")] });
    expect(labels(nav.panel)).toEqual(["Inicio", "Reservas", "Huéspedes", "Alojamientos"]);
  });

  it("shows only Inicio while the business is not approved", () => {
    for (const status of ["pending_approval", "rejected"] as const) {
      const nav = shellNavigation({ isPlatformAdmin: false, memberships: [member("owner", status)] });
      expect(labels(nav.panel)).toEqual(["Inicio"]);
    }
  });

  it("sends a platform admin without a business to the admin area, with no panel tabs", () => {
    const nav = shellNavigation({ isPlatformAdmin: true, memberships: [] });
    expect(nav.panel).toBeNull();
    expect(labels(nav.admin)).toEqual(["Organizaciones", "Planes y ajustes", "Feriados", "Actividad", "Errores", "Administradores"]);
    expect(nav.home).toBe("/admin");
  });

  it("gives a platform admin who also owns a business both areas", () => {
    const nav = shellNavigation({ isPlatformAdmin: true, memberships: [member("owner")] });
    expect(nav.panel).not.toBeNull();
    expect(nav.admin).not.toBeNull();
    expect(nav.home).toBe("/panel");
  });

  it("shows nothing but Inicio when there is no session", () => {
    const nav = shellNavigation(null);
    expect(labels(nav.panel)).toEqual(["Inicio"]);
    expect(nav.admin).toBeNull();
  });
});

describe("isActive", () => {
  it("marks a section on its own page and below it", () => {
    const item = { href: "/panel/reservas", label: "Reservas" };
    expect(isActive(item, "/panel/reservas")).toBe(true);
    expect(isActive(item, "/panel/reservas/123")).toBe(true);
    expect(isActive(item, "/panel/reservas-viejas")).toBe(false);
  });

  it("marks a section home only on its exact path, or under its extra prefixes", () => {
    const home = { href: "/admin", label: "Organizaciones", exact: true, also: ["/admin/organizaciones"] };
    expect(isActive(home, "/admin")).toBe(true);
    expect(isActive(home, "/admin/organizaciones/abc")).toBe(true);
    expect(isActive(home, "/admin/planes")).toBe(false);
  });
});
