import Link from "next/link";
import type { ReactNode } from "react";

import { BrandLogo } from "@/components/brand/logo";
import { logoutAction } from "@/modules/organizaciones/actions";
import { getAccess } from "@/modules/organizaciones/session";

import { shellNavigation } from "./nav";
import { ShellBottomNav } from "./shell-bottom-nav";
import { ShellNav } from "./shell-nav";
import { SupportLink } from "./support-link";

type AppShellProps = { title: string; children: ReactNode };

// Frame of the private areas (owner panel and platform admin) with the "Reservas Traslasierra" brand.
// The navigation only shows what the user can open; every page still authorizes itself.
export async function AppShell({ title, children }: AppShellProps) {
  const access = await getAccess();
  const nav = shellNavigation(access);

  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-brand-green-deep pt-[env(safe-area-inset-top)] text-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 pt-3 pb-2">
          <Link
            href={nav.home}
            aria-label="Reservas Traslasierra, inicio del panel"
            className="rounded-md focus-visible:ring-2 focus-visible:ring-brand-ochre focus-visible:outline-none"
          >
            <BrandLogo tone="light" />
          </Link>
          <div className="flex min-w-0 items-center gap-3 text-sm">
            {access ? (
              <span title={access.user.email} className="hidden max-w-[9rem] truncate text-xs text-brand-sand/85 sm:inline sm:max-w-none sm:text-sm">
                {access.user.email}
              </span>
            ) : null}
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
        <ShellNav panel={nav.panel} admin={nav.admin} />
      </header>

      <div className="border-b bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-5">
          <h1 className="font-heading text-2xl leading-tight font-bold text-brand-green-deep sm:text-3xl">{title}</h1>
        </div>
      </div>

      {/* On phones the bottom bar (fixed, ~56px) would cover the end of the page without this padding. */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-8">{children}</main>
      <footer className="border-t bg-white pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <SupportLink className="mx-auto w-full max-w-6xl px-4 py-4 text-sm text-muted-foreground" linkClassName="text-brand-green-deep" />
      </footer>
      <ShellBottomNav panel={nav.panel} admin={nav.admin} />
    </div>
  );
}
