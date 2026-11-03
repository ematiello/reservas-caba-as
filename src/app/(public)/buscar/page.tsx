import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { searchProperties } from "@/modules/publico/queries";
import { propertyHref, type Search, searchQuerySchema } from "@/modules/publico/search";
import { BRAND } from "@/modules/publico/seo";
import { formatDate, todayIn } from "@/modules/reservas/calendar";

import { PropertyCard } from "../property-card";
import { SearchBar } from "../search-bar";

// Search results (D26). Live: availability changes with every booking. Result pages are not indexed
// (endless query combinations); the establishments' own pages are.
export const metadata: Metadata = {
  title: `Buscar alojamiento | ${BRAND}`,
  robots: { index: false, follow: true },
};

const TIME_ZONE = "America/Argentina/Buenos_Aires";

export default function SearchPage(props: PageProps<"/buscar">) {
  // A full-height fallback keeps the footer below the fold while the content streams in (no layout shift).
  return (
    <Suspense fallback={<div className="min-h-svh" aria-busy="true" />}>
      <SearchContent {...props} />
    </Suspense>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function SearchContent({ searchParams }: PageProps<"/buscar">) {
  const query = await searchParams;
  // Today's date is per request, never part of the prerendered shell.
  await connection();
  const today = todayIn(TIME_ZONE);
  const raw = { q: first(query.q), ingreso: first(query.ingreso), salida: first(query.salida), huespedes: first(query.huespedes) };
  const parsed = searchQuerySchema(today).safeParse(raw);
  const search = parsed.success ? parsed.data : null;
  const results = search ? await searchProperties(search) : [];

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10">
      <h1 className="font-display text-3xl font-bold text-brand-green-deep">Buscar alojamiento</h1>
      <SearchBar
        today={today}
        values={
          search ?? {
            query: raw.q ?? "",
            checkIn: raw.ingreso ?? null,
            checkOut: raw.salida ?? null,
            guests: raw.huespedes ? Number(raw.huespedes) || null : null,
          }
        }
      />

      {!search ? (
        <p role="alert" className="rounded-xl bg-brand-sand p-4 font-semibold text-[#9b2c1d]">
          Revisá la búsqueda: las dos fechas o ninguna, el ingreso desde hoy, la salida después del ingreso (hasta 365
          noches) y de 1 a 50 huéspedes.
        </p>
      ) : (
        <section aria-labelledby="resultados" className="grid gap-5">
          <h2 id="resultados" className="font-display text-xl font-semibold">
            {summary(search, results.length)}
          </h2>
          {results.length === 0 ? (
            <div className="grid gap-2 rounded-xl bg-brand-sand p-5">
              <p>No encontramos alojamientos con esos datos.</p>
              <p className="text-sm">
                Probá con otras fechas, menos huéspedes o solo la localidad. También podés{" "}
                <Link href="/buscar" className="font-semibold text-brand-green underline underline-offset-4">
                  ver todos los alojamientos
                </Link>
                .
              </p>
            </div>
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((r) => (
                <li key={r.slug}>
                  <PropertyCard
                    href={propertyHref(r.slug, search)}
                    name={r.name}
                    place={[r.city, r.province].filter(Boolean).join(", ")}
                    photo={r.photo}
                    note={note(search, r.freeUnits)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function summary(search: Search, count: number): string {
  const found = count === 1 ? "1 alojamiento" : `${count} alojamientos`;
  const where = search.query ? ` para «${search.query}»` : "";
  const when = search.checkIn && search.checkOut ? `, libres del ${formatDate(search.checkIn)} al ${formatDate(search.checkOut)}` : "";
  const who = search.guests ? `, para ${search.guests} ${search.guests === 1 ? "huésped" : "huéspedes"}` : "";
  return `${found}${where}${when}${who}`;
}

function note(search: Search, freeUnits: number): string | undefined {
  if (!search.checkIn) return undefined;
  return freeUnits === 1 ? "1 unidad libre en esas fechas" : `${freeUnits} unidades libres en esas fechas`;
}
