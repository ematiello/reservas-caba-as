import Link from "next/link";
import type { ReactNode } from "react";

import { BrandLogo } from "@/components/brand/logo";
import { logoutAction } from "@/modules/organizaciones/actions";
import { resolvePanelState } from "@/modules/organizaciones/panel-state";
import { getAccess } from "@/modules/organizaciones/session";

import { ShellNav, type NavItem } from "./shell-nav";

type AppShellProps = {
  title: string;
  /** Short line under the title (for example, the organization or the record being edited). */
  subtitle?: string;
  children: ReactNode;
};

// Frame of the private areas (owner panel and platform admin) with the "Reservas Traslasierra" brand.
// The navigation only shows what the user can open; every page still authorizes itself.
export async function AppShell({ title, subtitle, children }: AppShellProps) {
  const access = await getAccess();
  const state = access ? resolvePanelState(access.memberships) : null;
  const active = state?.kind === "active" ? state.membership : null;

  const panel: NavItem[] = [{ href: "/panel", label: "Inicio", exact: true }];
  if (active) {
    panel.push(
      { href: "/panel/reservas", label: "Reservas" },
      { href: "/panel/huespedes", label: "Huéspedes" },
      { href: "/panel/alojamientos", label: "Alojamientos" },
    );
    if (active.role === "owner") {
      panel.push({ href: "/panel/equipo", label: "Equipo" }, { href: "/panel/suscripcion", label: "Suscripción" });
    }
  }
  const admin: NavItem[] | null = access?.isPlatformAdmin
    ? [
        { href: "/admin", label: "Organizaciones", exact: true, also: ["/admin/organizaciones"] },
        { href: "/admin/planes", label: "Planes y ajustes" },
        { href: "/admin/feriados", label: "Feriados" },
      ]
    : null;

  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-brand-green-deep text-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 pt-3 pb-2">
          <Link
            href={access?.isPlatformAdmin && !access.memberships.length ? "/admin" : "/panel"}
            aria-label="Reservas Traslasierra, inicio del panel"
            className="rounded-md focus-visible:ring-2 focus-visible:ring-brand-ochre focus-visible:outline-none"
          >
            <BrandLogo tone="light" />
          </Link>
          <div className="flex min-w-0 items-center gap-3 text-sm">
            {access ? <span className="hidden truncate text-brand-sand/85 sm:inline">{access.user.email}</span> : null}
            <form action={logoutAction}>
              <button
                type="submit"
                className="font-heading rounded-full border border-white/40 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-brand-ochre focus-visible:outline-none"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
        <ShellNav panel={access?.memberships.length || !access?.isPlatformAdmin ? panel : null} admin={admin} />
      </header>

      <div className="border-b bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-5">
          <h1 className="font-heading text-2xl leading-tight font-bold text-brand-green-deep sm:text-3xl">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
