import { resolvePanelState } from "@/modules/organizaciones/panel-state";
import type { Access } from "@/modules/organizaciones/session";

export type NavItem = {
  href: string;
  label: string;
  /** Active only on the exact path (section home pages). */
  exact?: boolean;
  /** Other path prefixes that belong to this item. */
  also?: string[];
};

export type ShellNavigation = {
  /** Owner-panel tabs; null for a platform admin without a business of their own. */
  panel: NavItem[] | null;
  /** Admin tabs; null for anyone who is not a platform admin. */
  admin: NavItem[] | null;
  /** Where the logo leads. */
  home: "/panel" | "/admin";
};

/**
 * Tabs the user can open. Display only: every page still authorizes itself (CLAUDE.md), so a tab
 * shown by mistake would land on a redirect, never on data.
 */
export function shellNavigation(access: Pick<Access, "isPlatformAdmin" | "memberships"> | null): ShellNavigation {
  const adminOnly = Boolean(access?.isPlatformAdmin && access.memberships.length === 0);
  const state = access ? resolvePanelState(access.memberships) : null;
  const active = state?.kind === "active" ? state.membership : null;

  const panel: NavItem[] = [{ href: "/panel", label: "Inicio", exact: true }];
  if (active) {
    panel.push(
      { href: "/panel/reservas", label: "Reservas" },
      { href: "/panel/huespedes", label: "Huéspedes" },
      { href: "/panel/alojamientos", label: "Alojamientos" },
    );
    // Holidays are setup (owner and admin, requireManagerAccess); team, subscription and the
    // organization itself are the owner's (requireOwnerAccess).
    if (active.role !== "operator") panel.push({ href: "/panel/feriados", label: "Feriados" });
    if (active.role === "owner") {
      panel.push(
        { href: "/panel/equipo", label: "Equipo" },
        { href: "/panel/suscripcion", label: "Suscripción" },
        { href: "/panel/organizacion", label: "Organización" },
      );
    }
  }

  const admin: NavItem[] | null = access?.isPlatformAdmin
    ? [
        { href: "/admin", label: "Organizaciones", exact: true, also: ["/admin/organizaciones"] },
        { href: "/admin/planes", label: "Planes y ajustes" },
        { href: "/admin/feriados", label: "Feriados" },
        { href: "/admin/actividad", label: "Actividad" },
        { href: "/admin/errores", label: "Errores" },
        { href: "/admin/administradores", label: "Administradores" },
      ]
    : null;

  return { panel: adminOnly ? null : panel, admin, home: adminOnly ? "/admin" : "/panel" };
}

export function isActive(item: NavItem, path: string): boolean {
  const under = (prefix: string) => path === prefix || path.startsWith(`${prefix}/`);
  if (item.also?.some(under)) return true;
  return item.exact ? path === item.href : under(item.href);
}
