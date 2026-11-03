import { resolvePanelState } from "@/modules/organizaciones/panel-state";
import type { Access } from "@/modules/organizaciones/session";

/** Icon keys; the bottom bar maps them to components so this module stays free of React. */
export type NavIcon =
  | "home"
  | "search"
  | "circle-plus"
  | "log-in"
  | "calendar"
  | "users"
  | "house"
  | "calendar-days"
  | "user-cog"
  | "credit-card"
  | "building"
  | "building-2"
  | "settings"
  | "activity"
  | "triangle-alert"
  | "shield";

export type NavItem = {
  href: string;
  label: string;
  icon?: NavIcon;
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

  const panel: NavItem[] = [{ href: "/panel", label: "Inicio", exact: true, icon: "home" }];
  if (active) {
    panel.push(
      { href: "/panel/reservas", label: "Reservas", icon: "calendar" },
      { href: "/panel/huespedes", label: "Huéspedes", icon: "users" },
      { href: "/panel/alojamientos", label: "Alojamientos", icon: "house" },
    );
    // Holidays are setup (owner and admin, requireManagerAccess); team, subscription and the
    // organization itself are the owner's (requireOwnerAccess).
    if (active.role !== "operator") panel.push({ href: "/panel/feriados", label: "Feriados", icon: "calendar-days" });
    if (active.role === "owner") {
      panel.push(
        { href: "/panel/equipo", label: "Equipo", icon: "user-cog" },
        { href: "/panel/suscripcion", label: "Suscripción", icon: "credit-card" },
        { href: "/panel/organizacion", label: "Organización", icon: "building" },
      );
    }
  }

  const admin: NavItem[] | null = access?.isPlatformAdmin
    ? [
        { href: "/admin", label: "Organizaciones", exact: true, also: ["/admin/organizaciones"], icon: "building-2" },
        { href: "/admin/planes", label: "Planes y ajustes", icon: "settings" },
        { href: "/admin/feriados", label: "Feriados", icon: "calendar-days" },
        { href: "/admin/actividad", label: "Actividad", icon: "activity" },
        { href: "/admin/errores", label: "Errores", icon: "triangle-alert" },
        { href: "/admin/administradores", label: "Administradores", icon: "shield" },
      ]
    : null;

  return { panel: adminOnly ? null : panel, admin, home: adminOnly ? "/admin" : "/panel" };
}

export function isActive(item: NavItem, path: string): boolean {
  const under = (prefix: string) => path === prefix || path.startsWith(`${prefix}/`);
  if (item.also?.some(under)) return true;
  return item.exact ? path === item.href : under(item.href);
}

/**
 * Items of the public bottom bar. Fixed on purpose: reading the session here would make every
 * public page dynamic (CLAUDE.md, cacheComponents), and the home page is static.
 */
export const publicNavigation: NavItem[] = [
  { href: "/", label: "Inicio", exact: true, icon: "home" },
  { href: "/buscar", label: "Buscar", icon: "search" },
  { href: "/auth/registro", label: "Publicar", icon: "circle-plus" },
  { href: "/auth/login", label: "Ingresar", icon: "log-in" },
];

/** At most five slots in a bottom bar: with more items the last slot becomes "Más". */
export function splitBottomNav(items: NavItem[], max = 5): { primary: NavItem[]; overflow: NavItem[] } {
  if (items.length <= max) return { primary: items, overflow: [] };
  return { primary: items.slice(0, max - 1), overflow: items.slice(max - 1) };
}

export type NavArea = {
  items: NavItem[];
  label: "Administración" | "Panel";
  /** Link to the other area, when the user has both. */
  other: { href: string; label: string } | null;
};

/** Which set of tabs applies to this path. Shared by the top tabs and the bottom bar. */
export function resolveArea(path: string, panel: NavItem[] | null, admin: NavItem[] | null): NavArea {
  const inAdmin = path === "/admin" || path.startsWith("/admin/");
  if (inAdmin) {
    return {
      items: admin ?? [],
      label: "Administración",
      other: panel ? { href: "/panel", label: "Ir al panel" } : null,
    };
  }
  return {
    items: panel ?? [],
    label: "Panel",
    other: admin ? { href: "/admin", label: "Administración" } : null,
  };
}
