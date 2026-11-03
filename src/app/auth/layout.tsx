import Link from "next/link";

import { BrandLogo } from "@/components/brand/logo";
import { Sierras } from "@/components/brand/sierras";

// Sign-in, sign-up and invitations: the brand's sierras behind a centered card.
export default function AuthLayout({ children }: LayoutProps<"/auth">) {
  return (
    <div className="relative isolate flex flex-1 flex-col">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-72 overflow-hidden opacity-70">
        <Sierras />
      </div>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
        <Link
          href="/"
          aria-label="Reservas Traslasierra, inicio"
          className="self-center rounded-md focus-visible:ring-2 focus-visible:ring-brand-olive focus-visible:outline-none"
        >
          <BrandLogo className="scale-125" />
        </Link>
        {children}
      </main>
    </div>
  );
}
