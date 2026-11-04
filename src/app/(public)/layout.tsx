import Link from "next/link";
import { Suspense } from "react";

import { BrandLogo } from "@/components/brand/logo";
import { BottomNav, BottomNavFallback } from "@/components/shell/bottom-nav";
import { publicNavigation } from "@/components/shell/nav";
import { SupportLink } from "@/components/shell/support-link";

// Public side of the platform (home, search and /{slug}). Fonts and colors come from the root
// layout and the global theme ("Identidad serrana"); the paper ground is the public one.
// The phone bottom bar has fixed items and never reads the session, so these pages stay static.
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="brand flex min-h-full flex-1 flex-col">
      <header className="border-b border-[var(--border)] bg-white/90 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" aria-label="Reservas Traslasierra, inicio" className="rounded-md focus-visible:ring-2 focus-visible:ring-brand-olive focus-visible:outline-none">
            <BrandLogo />
          </Link>
          <Link
            href="/auth/registro"
            className="font-display rounded-full bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green-deep focus-visible:ring-2 focus-visible:ring-brand-ochre focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Publicá tu alojamiento
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="bg-brand-green-deep pb-[calc(4rem+env(safe-area-inset-bottom))] text-white md:pb-0">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-3">
            <BrandLogo tone="light" />
            <p className="font-display max-w-sm text-lg font-medium text-brand-sand">
              Naturaleza, descanso y alojamientos con encanto.
            </p>
          </div>
          <nav aria-label="Pie de página" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-brand-sand">
            <Link href="/auth/login" className="underline-offset-4 hover:underline">
              Ingreso de propietarios
            </Link>
            <Link href="/auth/registro" className="underline-offset-4 hover:underline">
              Publicá tu alojamiento
            </Link>
          </nav>
          <SupportLink className="text-sm text-brand-sand sm:col-span-2" linkClassName="text-white" />
        </div>
      </footer>
      <Suspense fallback={<BottomNavFallback items={publicNavigation} label="Navegación principal" />}>
        <BottomNav items={publicNavigation} label="Navegación principal" />
      </Suspense>
    </div>
  );
}
