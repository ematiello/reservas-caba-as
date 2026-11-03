import {
  AirVent,
  Bath,
  BedDouble,
  Car,
  Coffee,
  CookingPot,
  Flame,
  Heater,
  Leaf,
  type LucideIcon,
  PawPrint,
  ShowerHead,
  Sparkles,
  Tv,
  Utensils,
  WashingMachine,
  Waves,
  Wifi,
} from "lucide-react";
import Link from "next/link";

import { Sierras } from "@/components/brand/sierras";
import { UNIT_KIND_LABEL } from "@/modules/alojamientos/schemas";
import type { Amenity, Photo, PublicProperty, PublicUnit } from "@/modules/publico/queries";
import { type StayQuery, whatsappLink } from "@/modules/publico/stay";
import { formatDate, nights } from "@/modules/reservas/calendar";
import { formatArs } from "@/modules/suscripciones/billing";
import type { PricingResult } from "@/modules/tarifas/pricing";

// Server-rendered pieces of the public page. No client JavaScript: the stay form is a plain GET.

const AMENITY_ICON: Record<string, LucideIcon> = {
  wifi: Wifi,
  air_conditioning: AirVent,
  heating: Heater,
  fireplace: Flame,
  kitchen: CookingPot,
  grill: Utensils,
  pool: Waves,
  parking: Car,
  tv: Tv,
  linens: BedDouble,
  towels: Bath,
  pets_allowed: PawPrint,
  breakfast: Coffee,
  washing_machine: WashingMachine,
  private_bathroom: ShowerHead,
  garden: Leaf,
};

const pill =
  "font-display inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none";
export const greenButton = `${pill} bg-brand-green text-white hover:bg-brand-green-deep focus-visible:ring-brand-ochre`;
const ochreButton = `${pill} bg-brand-ochre text-brand-slate hover:bg-[#d9913a] focus-visible:ring-brand-green`;

/* eslint-disable @next/next/no-img-element -- Storage photos are resized in the browser before upload; no optimizer (images.unoptimized). */

export function Hero({ property }: { property: PublicProperty }) {
  const cover = property.photos[0];
  const place = [property.city, property.province].filter(Boolean).join(", ");
  return (
    // With a photo the title sits on its darkened foot; on the drawing it sits in the sky, above the ridges.
    <section
      className={`relative isolate flex min-h-[22rem] overflow-hidden sm:min-h-[28rem] ${cover ? "items-end" : "items-start"}`}
    >
      <div className="absolute inset-0 -z-10">
        {cover ? (
          <>
            <img src={cover.url} alt={cover.alt} fetchPriority="high" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#163f32]/85 via-[#163f32]/30 to-transparent" />
          </>
        ) : (
          <Sierras />
        )}
      </div>
      <div className={`mx-auto w-full max-w-6xl px-4 ${cover ? "pt-24 pb-14" : "pt-10 pb-52 sm:pt-14"}`}>
        <h1
          className={`font-display max-w-[18ch] text-[clamp(2.2rem,6vw,4rem)] leading-[1.02] font-extrabold tracking-tight ${
            cover ? "text-white" : "text-brand-green-deep"
          }`}
        >
          {property.name}
        </h1>
        {place ? <p className={`mt-3 text-lg ${cover ? "text-brand-sand" : "text-brand-slate"}`}>{place}</p> : null}
      </div>
    </section>
  );
}

export function StayForm({ today, values, error }: { today: string; values: Partial<Record<"ingreso" | "salida" | "huespedes", string>>; error: boolean }) {
  return (
    <form
      method="get"
      action="#disponibilidad"
      aria-describedby={error ? "stay-error" : undefined}
      className="grid gap-3 rounded-2xl bg-white p-4 shadow-[0_12px_32px_-18px_rgba(22,63,50,0.45)] ring-1 ring-[var(--border)] sm:grid-cols-[1fr_1fr_8rem_auto] sm:items-end"
    >
      <label className="grid gap-1 text-sm font-semibold">
        Ingreso
        <input type="date" name="ingreso" required min={today} defaultValue={values.ingreso} className={field} />
      </label>
      <label className="grid gap-1 text-sm font-semibold">
        Salida
        <input type="date" name="salida" required min={today} defaultValue={values.salida} className={field} />
      </label>
      <label className="grid gap-1 text-sm font-semibold">
        Huéspedes
        <input type="number" name="huespedes" required min={1} max={50} defaultValue={values.huespedes ?? "2"} className={field} />
      </label>
      <button type="submit" className={ochreButton}>
        Ver disponibilidad
      </button>
      {error ? (
        <p id="stay-error" role="alert" className="text-sm font-semibold text-[#9b2c1d] sm:col-span-4">
          Revisá las fechas: el ingreso desde hoy, la salida después del ingreso y hasta 365 noches.
        </p>
      ) : null}
    </form>
  );
}

const field =
  "h-11 rounded-lg border border-[var(--input)] bg-white px-3 font-normal text-brand-slate focus-visible:border-brand-green focus-visible:ring-2 focus-visible:ring-brand-olive/50 focus-visible:outline-none";

export type UnitResult = { unit: PublicUnit; status: "free" | "taken" | "too_many_guests"; price: PricingResult | null };

export function StayResults({ property, stay, results }: { property: PublicProperty; stay: StayQuery; results: UnitResult[] }) {
  const n = nights(stay.checkIn, stay.checkOut);
  const free = results.filter((r) => r.status === "free" && !(r.price && !r.price.ok && r.price.error === "min_nights"));
  return (
    <div className="grid gap-4">
      <p className="font-display text-xl font-semibold text-brand-green-deep">
        Del {formatDate(stay.checkIn)} al {formatDate(stay.checkOut)}: {n} {n === 1 ? "noche" : "noches"}, {stay.guests}{" "}
        {stay.guests === 1 ? "huésped" : "huéspedes"}.
      </p>
      {free.length === 0 ? (
        <p className="rounded-xl bg-brand-sand p-4">
          No hay unidades libres para esas fechas. Probá con otras o escribile al alojamiento: a veces hay opciones que no
          figuran acá.
        </p>
      ) : null}
      <ul className="grid gap-3">
        {results.map((r) => (
          <li key={r.unit.id} className="grid gap-3 rounded-xl bg-white p-4 ring-1 ring-[var(--border)] sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="font-display font-semibold text-brand-green-deep">{r.unit.name}</p>
              <ResultLine result={r} />
            </div>
            {r.status === "free" && property.whatsapp && !(r.price && !r.price.ok && r.price.error === "min_nights") ? (
              <a
                href={whatsappLink(property.whatsapp, { propertyName: property.name, unitName: r.unit.name, stay })}
                target="_blank"
                rel="noopener noreferrer"
                className={greenButton}
              >
                Consultar por WhatsApp
              </a>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">
        Consultar no reserva las fechas: la reserva queda firme cuando el alojamiento la confirma. Los precios son de lista
        y los calcula el alojamiento con sus tarifas vigentes.
      </p>
    </div>
  );
}

function ResultLine({ result }: { result: UnitResult }) {
  if (result.status === "taken") return <p className="text-sm text-muted-foreground">Ocupada en esas fechas.</p>;
  if (result.status === "too_many_guests")
    return <p className="text-sm text-muted-foreground">Hasta {result.unit.maxGuests} huéspedes.</p>;
  const price = result.price;
  if (price?.ok) {
    const q = price.quote;
    return (
      <div className="text-sm">
        <p>
          <span className="font-display text-lg font-bold text-brand-green-deep">{formatArs(q.totalCents)}</span>{" "}
          <span className="text-muted-foreground">en total</span>
        </p>
        {q.discountCents > 0 ? <p className="text-muted-foreground">Incluye {q.discountPct} % de descuento por estadía.</p> : null}
        {q.depositCents > 0 ? <p className="text-muted-foreground">Seña sugerida: {formatArs(q.depositCents)}.</p> : null}
      </div>
    );
  }
  if (price && !price.ok && price.error === "min_nights")
    return <p className="text-sm text-muted-foreground">Para esas fechas, la estadía mínima es de {price.minNights} noches.</p>;
  return <p className="text-sm">Libre. Consultá el precio por WhatsApp.</p>;
}

export function UnitCard({ unit }: { unit: PublicUnit }) {
  const photo = unit.photos[0];
  const facts = [
    `Hasta ${unit.maxGuests} ${unit.maxGuests === 1 ? "huésped" : "huéspedes"}`,
    unit.bedrooms ? `${unit.bedrooms} ${unit.bedrooms === 1 ? "dormitorio" : "dormitorios"}` : null,
    unit.beds ? `${unit.beds} ${unit.beds === 1 ? "cama" : "camas"}` : null,
  ].filter(Boolean);
  return (
    <article className="overflow-hidden rounded-2xl bg-white ring-1 ring-[var(--border)]">
      {photo ? (
        <div className="aspect-[3/2] bg-brand-sand">
          <img src={photo.url} alt={photo.alt} loading="lazy" className="h-full w-full object-cover" />
        </div>
      ) : (
        <div aria-hidden="true" className="h-1.5 bg-gradient-to-r from-brand-green via-brand-olive to-brand-ochre" />
      )}
      <div className="grid gap-3 p-5">
        <div>
          <p className="text-sm text-muted-foreground">{unit.categoryName ?? UNIT_KIND_LABEL[unit.kind]}</p>
          <h3 className="font-display text-xl font-bold text-brand-green-deep">{unit.name}</h3>
        </div>
        <p className="text-sm font-semibold">{facts.join(", ")}</p>
        {unit.description ? <p className="leading-relaxed whitespace-pre-line">{unit.description}</p> : null}
        {unit.amenities.length ? <AmenityList amenities={unit.amenities} /> : null}
      </div>
    </article>
  );
}

function AmenityList({ amenities }: { amenities: Amenity[] }) {
  return (
    <ul aria-label="Comodidades" className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
      {amenities.map((a) => {
        const Icon = AMENITY_ICON[a.code] ?? Sparkles;
        return (
          <li key={a.code} className="inline-flex items-center gap-1.5">
            <Icon aria-hidden="true" className="size-4 text-brand-green" strokeWidth={1.75} />
            {a.name}
          </li>
        );
      })}
    </ul>
  );
}

export function Gallery({ photos }: { photos: Photo[] }) {
  return (
    <ul aria-label="Fotos" className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
      {photos.map((p) => (
        <li key={p.url} className="w-72 shrink-0 snap-start overflow-hidden rounded-xl bg-brand-sand sm:w-96">
          <img src={p.url} alt={p.alt} loading="lazy" className="aspect-[3/2] h-full w-full object-cover" />
        </li>
      ))}
    </ul>
  );
}

/* eslint-enable @next/next/no-img-element */

export function Unavailable() {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <Sierras />
      </div>
      <div className="mx-auto grid max-w-6xl gap-4 px-4 pt-16 pb-60">
        <h1 className="font-display max-w-[20ch] text-4xl font-extrabold text-brand-green-deep">
          Este alojamiento no está disponible por ahora
        </h1>
        <p className="max-w-prose text-lg">Volvé a intentar más adelante o mirá otros alojamientos de la zona.</p>
        <div>
          <Link href="/#alojamientos" className={greenButton}>
            Ver alojamientos
          </Link>
        </div>
      </div>
    </section>
  );
}

/** schema.org LodgingBusiness for search engines (docs/02). */
export function LodgingJsonLd({ property, url }: { property: PublicProperty; url: string | undefined }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: property.name,
    description: property.description || undefined,
    url,
    image: property.photos.map((p) => p.url),
    telephone: property.whatsapp ? `+${property.whatsapp}` : undefined,
    checkinTime: property.checkInTime ?? undefined,
    checkoutTime: property.checkOutTime ?? undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: property.address ?? undefined,
      addressLocality: property.city ?? undefined,
      addressRegion: property.province ?? undefined,
      addressCountry: "AR",
    },
    geo:
      property.lat !== null && property.lng !== null
        ? { "@type": "GeoCoordinates", latitude: property.lat, longitude: property.lng }
        : undefined,
  };
  // "<" is escaped so the owner's text can never close the script tag.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
