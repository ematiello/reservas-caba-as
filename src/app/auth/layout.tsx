import Link from "next/link";
import { Suspense } from "react";

import { BrandLogo } from "@/components/brand/logo";
import { Sierras } from "@/components/brand/sierras";
import { BottomNav, BottomNavFallback } from "@/components/shell/bottom-nav";
import { publicNavigation } from "@/components/shell/nav";
import { SupportLink } from "@/components/shell/support-link";

// Sign-in, sign-up and invitations: the brand's sierras behind a centered card.
export default function AuthLayout({ children }: LayoutProps<"/auth">) {
  return (
    <div className="relative isolate flex flex-1 flex-col">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-72 overflow-hidden opacity-70">
        <Sierras />
      </div>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 pt-10 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-10">
        <Link
          href="/"
          aria-label="Reservas Traslasierra, inicio"
          className="self-center rounded-md focus-visible:ring-2 focus-visible:ring-brand-olive focus-visible:outline-none"
        >
          <BrandLogo className="scale-125" />
        </Link>
        {children}
        <SupportLink className="text-center text-sm text-muted-foreground" linkClassName="text-brand-green-deep" />
      </main>
      <Suspense fallback={<BottomNavFallback items={publicNavigation} label="Navegación principal" />}>
        <BottomNav items={publicNavigation} label="Navegación principal" />
      </Suspense>
    </div>
  );
}
