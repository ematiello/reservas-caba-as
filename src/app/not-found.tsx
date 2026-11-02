import type { Metadata } from "next";
import Link from "next/link";

import { BrandLogo } from "@/components/brand/logo";
import { Sierras } from "@/components/brand/sierras";

// Any unknown address outside the public pages, and private routes the user may not open (for
// example /admin for someone who is not a platform admin): the copy never says which one it was.
export const metadata: Metadata = { title: "Página no encontrada", robots: { index: false, follow: false } };

const pill =
  "font-heading inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none";

export default function NotFound() {
  return (
    <div className="relative isolate flex flex-1 flex-col bg-background">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-80 overflow-hidden">
        <Sierras />
      </div>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start justify-center gap-5 px-4 pt-12 pb-72">
        <Link
          href="/"
          aria-label="Reservas Traslasierra, inicio"
          className="rounded-md focus-visible:ring-2 focus-visible:ring-brand-olive focus-visible:outline-none"
        >
          <BrandLogo />
        </Link>
        <h1 className="font-heading text-4xl leading-tight font-extrabold text-brand-green-deep">
          No encontramos esta página
        </h1>
        <p className="max-w-prose text-lg">
          Puede que la dirección esté mal escrita o que la página ya no exista. Volvé al inicio o entrá a tu panel.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/" className={`${pill} bg-brand-green text-white hover:bg-brand-green-deep focus-visible:ring-brand-ochre`}>
            Ir al inicio
          </Link>
          <Link
            href="/panel"
            className={`${pill} border border-input bg-white text-brand-green-deep hover:bg-muted focus-visible:ring-brand-olive`}
          >
            Ir a mi panel
          </Link>
        </div>
      </main>
    </div>
  );
}
