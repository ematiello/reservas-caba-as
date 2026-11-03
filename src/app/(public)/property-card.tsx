import Link from "next/link";

import { Sierras } from "@/components/brand/sierras";
import type { Photo } from "@/modules/publico/queries";

// One establishment in a list (home and search results): photo, name, place and an optional note.
export function PropertyCard({ href, name, place, photo, note }: { href: string; name: string; place: string; photo: Photo | null; note?: string }) {
  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-2xl bg-white shadow-[0_1px_0_#e3d6c4] ring-1 ring-[var(--border)] focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:outline-none"
    >
      <div className="aspect-[4/3] overflow-hidden bg-brand-sand">
        {photo ? (
          // Photos are resized in the browser before upload; no optimizer (images.unoptimized).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.url}
            alt={photo.alt}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
          />
        ) : (
          <Sierras />
        )}
      </div>
      <div className="grid gap-0.5 p-4">
        <p className="font-display text-lg font-semibold text-brand-green-deep">{name}</p>
        {place ? <p className="text-sm text-muted-foreground">{place}</p> : null}
        {note ? <p className="mt-1 text-sm font-semibold text-brand-green">{note}</p> : null}
      </div>
    </Link>
  );
}
