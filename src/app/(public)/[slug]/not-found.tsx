import Link from "next/link";

import { Sierras } from "@/components/brand/sierras";

// Unknown slugs and unpublished drafts. The page streams, so the response may carry status 200;
// Next.js adds <meta name="robots" content="noindex"> so search engines drop it anyway.
export default function PropertyNotFound() {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <Sierras />
      </div>
      <div className="mx-auto grid max-w-6xl gap-4 px-4 pt-16 pb-60">
        <h1 className="font-display max-w-[20ch] text-4xl font-extrabold text-brand-green-deep">No encontramos ese alojamiento</h1>
        <p className="max-w-prose text-lg">Puede que la dirección esté mal escrita o que el alojamiento ya no esté publicado.</p>
        <div>
          <Link
            href="/#alojamientos"
            className="font-display inline-flex rounded-full bg-brand-green px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-green-deep focus-visible:ring-2 focus-visible:ring-brand-ochre focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Ver alojamientos
          </Link>
        </div>
      </div>
    </section>
  );
}
