import { z } from "zod";

import { type ISODate, isISODate, nights } from "@/modules/reservas/calendar";

// The visitor's search (D26): place or name, and optionally dates and guests. Mirrors the checks of
// public_search in the database; an empty search lists every published property.

export type Search = { query: string; checkIn: ISODate | null; checkOut: ISODate | null; guests: number | null };

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

/** ?q=&ingreso=&salida=&huespedes= as a search; `today` is the date in Argentina. */
export function searchQuerySchema(today: ISODate) {
  const date = z.preprocess(blankToUndefined, z.string().refine(isISODate).optional());
  return z
    .object({
      q: z.preprocess((v) => (typeof v === "string" ? v.trim() : ""), z.string().max(80)),
      ingreso: date,
      salida: date,
      huespedes: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(50).optional()),
    })
    .refine((s) => (s.ingreso === undefined) === (s.salida === undefined), { path: ["salida"] })
    .refine((s) => !s.ingreso || s.ingreso >= today, { path: ["ingreso"] })
    .refine((s) => !s.ingreso || !s.salida || (s.salida > s.ingreso && nights(s.ingreso, s.salida) <= 365), {
      path: ["salida"],
    })
    .transform(
      (s): Search => ({ query: s.q, checkIn: s.ingreso ?? null, checkOut: s.salida ?? null, guests: s.huespedes ?? null }),
    );
}

/** Link to a result that opens its page already checking the searched dates. */
export function propertyHref(slug: string, search: Omit<Search, "query">): string {
  if (!search.checkIn || !search.checkOut) return `/${slug}`;
  const params = new URLSearchParams({
    ingreso: search.checkIn,
    salida: search.checkOut,
    huespedes: String(search.guests ?? 2),
  });
  return `/${slug}?${params}#disponibilidad`;
}
