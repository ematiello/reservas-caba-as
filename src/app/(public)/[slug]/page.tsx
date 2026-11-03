import { Clock, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
  getOccupied,
  getPageState,
  getPublicProperty,
  loadPublicProperty,
  type PublicProperty,
  quotePublicStay,
} from "@/modules/publico/queries";
import { BRAND, publicRobots, siteUrl } from "@/modules/publico/seo";
import { isUnitFree, stayQuerySchema, whatsappLink } from "@/modules/publico/stay";
import { addDays, todayIn } from "@/modules/reservas/calendar";

import { Gallery, greenButton, Hero, LodgingJsonLd, StayForm, StayResults, Unavailable, UnitCard, type UnitResult } from "./parts";

// Public page of an establishment (docs/02, D10, D12): photos, units, availability and price for the
// visitor's dates, and WhatsApp. It never creates a booking. A suspended account shows "no disponible"
// with noindex (invariant 6); drafts and unknown slugs are 404.

type Resolved = { state: "missing" } | { state: "unavailable" } | { state: "published"; property: PublicProperty };

async function resolve(slug: string): Promise<Resolved> {
  const state = await getPageState(slug);
  if (state !== "published") return { state };
  // The cache may still hold a miss from before the page went live: read it fresh then.
  const property = (await getPublicProperty(slug)) ?? (await loadPublicProperty(slug));
  return property ? { state, property } : { state: "missing" };
}

function excerpt(text: string, max = 160): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}

export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = await resolve(slug);
  if (page.state === "unavailable") return { title: `Alojamiento no disponible | ${BRAND}`, robots: { index: false, follow: false } };
  if (page.state === "missing") return { title: `Página no encontrada | ${BRAND}`, robots: { index: false, follow: false } };

  const p = page.property;
  const where = p.city ? ` en ${p.city}` : "";
  const description = excerpt(p.description || `${p.name}${where}. Consultá disponibilidad y precios para tus fechas.`);
  return {
    title: `${p.name}${where} | ${BRAND}`,
    description,
    robots: publicRobots(),
    metadataBase: siteUrl(),
    alternates: { canonical: `/${p.slug}` },
    openGraph: {
      type: "website",
      siteName: BRAND,
      locale: "es_AR",
      title: p.name,
      description,
      url: `/${p.slug}`,
      images: p.photos.slice(0, 1).map((photo) => ({ url: photo.url, alt: photo.alt })),
    },
  };
}

export default function PublicPropertyPage(props: PageProps<"/[slug]">) {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" aria-busy="true" />}>
      <PropertyContent {...props} />
    </Suspense>
  );
}

async function PropertyContent({ params, searchParams }: PageProps<"/[slug]">) {
  const { slug } = await params;
  const page = await resolve(slug);
  if (page.state === "missing") notFound();
  if (page.state === "unavailable") return <Unavailable />;

  const property = page.property;
  const query = await searchParams;
  const asked = typeof query.ingreso === "string" || typeof query.salida === "string";
  const today = todayIn(property.timezone);
  const values = {
    ingreso: typeof query.ingreso === "string" ? query.ingreso : undefined,
    salida: typeof query.salida === "string" ? query.salida : undefined,
    huespedes: typeof query.huespedes === "string" ? query.huespedes : undefined,
  };
  const parsed = asked ? stayQuerySchema(today).safeParse(values) : null;
  const stay = parsed?.success ? parsed.data : null;
  const results = stay ? await check(property, stay) : null;
  const base = siteUrl();

  return (
    <>
      <LodgingJsonLd property={property} url={base ? new URL(`/${property.slug}`, base).toString() : undefined} />
      <Hero property={property} />

      <section id="disponibilidad" className="relative z-10 mx-auto -mt-8 grid max-w-6xl scroll-mt-4 gap-6 px-4">
        <StayForm today={today} values={values} error={asked && !stay} />
        {stay && results ? <StayResults property={property} stay={stay} results={results} /> : null}
      </section>

      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-12 lg:grid-cols-[1fr_20rem]">
        <div className="grid content-start gap-10">
          {property.description ? (
            <section aria-labelledby="sobre">
              <h2 id="sobre" className="font-display text-2xl font-bold text-brand-green-deep">
                El lugar
              </h2>
              <p className="mt-3 max-w-[68ch] leading-relaxed whitespace-pre-line">{property.description}</p>
            </section>
          ) : null}

          {property.photos.length > 1 ? (
            <section aria-labelledby="fotos">
              <h2 id="fotos" className="font-display mb-4 text-2xl font-bold text-brand-green-deep">
                Fotos
              </h2>
              <Gallery photos={property.photos.slice(1)} />
            </section>
          ) : null}

          <section aria-labelledby="unidades">
            <h2 id="unidades" className="font-display text-2xl font-bold text-brand-green-deep">
              {property.units.length === 1 ? "El alojamiento" : "Unidades"}
            </h2>
            {property.units.length === 0 ? (
              <p className="mt-3 text-muted-foreground">Todavía no hay unidades publicadas. Consultá por WhatsApp.</p>
            ) : (
              <div className="mt-4 grid gap-6 md:grid-cols-2">
                {property.units.map((u) => (
                  <UnitCard key={u.id} unit={u} />
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="grid content-start gap-5 self-start rounded-2xl bg-brand-sand p-5 lg:sticky lg:top-4">
          {property.checkInTime || property.checkOutTime ? (
            <p className="flex gap-2">
              <Clock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-green" strokeWidth={1.75} />
              <span>
                {property.checkInTime ? `Ingreso desde las ${property.checkInTime.slice(0, 5)} h` : null}
                {property.checkInTime && property.checkOutTime ? <br /> : null}
                {property.checkOutTime ? `Salida hasta las ${property.checkOutTime.slice(0, 5)} h` : null}
              </span>
            </p>
          ) : null}
          {property.address || property.city ? (
            <p className="flex gap-2">
              <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-green" strokeWidth={1.75} />
              <span>{[property.address, property.city, property.province].filter(Boolean).join(", ")}</span>
            </p>
          ) : null}
          {property.whatsapp ? (
            <a
              href={whatsappLink(property.whatsapp, { propertyName: property.name, stay: stay ?? undefined })}
              target="_blank"
              rel="noopener noreferrer"
              className={greenButton}
            >
              Escribir por WhatsApp
            </a>
          ) : null}
        </aside>
      </div>
    </>
  );
}

// Live availability for the visitor's dates, then the server's list price for each free unit.
async function check(property: PublicProperty, stay: { checkIn: string; checkOut: string; guests: number }): Promise<UnitResult[]> {
  const occupied = await getOccupied(property.slug, stay.checkIn, addDays(stay.checkOut, property.cleaningBufferDays));
  return Promise.all(
    property.units.map(async (unit): Promise<UnitResult> => {
      if (stay.guests > unit.maxGuests) return { unit, status: "too_many_guests", price: null };
      if (!isUnitFree(unit.id, occupied, stay.checkIn, stay.checkOut, property.cleaningBufferDays))
        return { unit, status: "taken", price: null };
      return { unit, status: "free", price: await quotePublicStay(property.orgId, unit.id, stay) };
    }),
  );
}
