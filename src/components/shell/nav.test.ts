import { describe, expect, it } from "vitest";

import type { MemberRole, OrgMembership, OrgStatus } from "@/modules/organizaciones/panel-state";

import { isActive, publicNavigation, resolveArea, shellNavigation, splitBottomNav, type NavItem } from "./nav";

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

const items = (n: number): NavItem[] => Array.from({ length: n }, (_, i) => ({ href: `/p/${i}`, label: `Item ${i}` }));

describe("splitBottomNav", () => {
  it("keeps up to five items in the bar and has nothing to overflow", () => {
    for (const n of [0, 1, 4, 5]) {
      const { primary, overflow } = splitBottomNav(items(n));
      expect(primary).toHaveLength(n);
      expect(overflow).toEqual([]);
    }
  });

  it("shows the first four and moves the rest to the overflow when there are more than five", () => {
    const { primary, overflow } = splitBottomNav(items(8));
    expect(primary.map((i) => i.label)).toEqual(["Item 0", "Item 1", "Item 2", "Item 3"]);
    expect(overflow.map((i) => i.label)).toEqual(["Item 4", "Item 5", "Item 6", "Item 7"]);
    expect(splitBottomNav(items(6)).overflow).toHaveLength(2);
  });

  it("honors a custom maximum", () => {
    const { primary, overflow } = splitBottomNav(items(4), 3);
    expect(primary).toHaveLength(2);
    expect(overflow).toHaveLength(2);
  });
});

describe("publicNavigation", () => {
  it("has fixed items that need no session", () => {
    expect(publicNavigation.map((i) => [i.label, i.href])).toEqual([
      ["Inicio", "/"],
      ["Buscar", "/buscar"],
      ["Publicar", "/auth/registro"],
      ["Ingresar", "/auth/login"],
    ]);
    expect(isActive(publicNavigation[0], "/")).toBe(true);
    expect(isActive(publicNavigation[0], "/buscar")).toBe(false);
  });
});

describe("item icons", () => {
  it("gives every private item an icon so the bottom bar never renders a blank slot", () => {
    const owner = shellNavigation({ isPlatformAdmin: true, memberships: [member("owner")] });
    for (const item of [...(owner.panel ?? []), ...(owner.admin ?? []), ...publicNavigation]) {
      expect(item.icon, item.label).toBeTruthy();
    }
  });
});

describe("resolveArea", () => {
  const panel: NavItem[] = [{ href: "/panel", label: "Inicio", exact: true }];
  const admin: NavItem[] = [{ href: "/admin", label: "Organizaciones", exact: true }];

  it("picks the admin tabs under /admin and offers the way back to the panel", () => {
    const area = resolveArea("/admin/planes", panel, admin);
    expect(area).toEqual({ items: admin, label: "Administración", other: { href: "/panel", label: "Ir al panel" } });
  });

  it("picks the panel tabs elsewhere and offers the admin area", () => {
    const area = resolveArea("/panel/reservas", panel, admin);
    expect(area).toEqual({ items: panel, label: "Panel", other: { href: "/admin", label: "Administración" } });
  });

  it("offers no switch when the user only has one area", () => {
    expect(resolveArea("/panel", panel, null).other).toBeNull();
    expect(resolveArea("/admin", null, admin).other).toBeNull();
  });

  it("does not treat a look-alike path as the admin area", () => {
    expect(resolveArea("/administrar", panel, admin).label).toBe("Panel");
  });

  it("returns no items when the area has none", () => {
    expect(resolveArea("/panel", null, admin).items).toEqual([]);
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
