import { z } from "zod";

import { addDays, formatDate, type ISODate, isISODate, nights } from "@/modules/reservas/calendar";

// What a visitor asks on the public page: dates and guests. Pure helpers, shared by the page and
// its tests. Asking never books anything (D10): the stay is only checked and priced.

export type StayQuery = { checkIn: ISODate; checkOut: ISODate; guests: number };
export type OccupiedRange = { unitId: string; startsOn: ISODate; endsOn: ISODate };

const MAX_NIGHTS = 365;

/** The page's query string (?ingreso=&salida=&huespedes=) as a stay; `today` is the property's date. */
export function stayQuerySchema(today: ISODate) {
  const date = z.string().refine(isISODate);
  return z
    .object({ ingreso: date, salida: date, huespedes: z.coerce.number().int().min(1).max(50) })
    .refine((q) => q.ingreso >= today, { path: ["ingreso"] })
    .refine((q) => q.salida > q.ingreso && nights(q.ingreso, q.salida) <= MAX_NIGHTS, { path: ["salida"] })
    .transform((q): StayQuery => ({ checkIn: q.ingreso, checkOut: q.salida, guests: q.huespedes }));
}

/**
 * Free when no occupied range overlaps [checkIn, checkOut + cleaning days): the same rule as the
 * database exclusion, where both stays carry their cleaning days.
 */
export function isUnitFree(unitId: string, occupied: OccupiedRange[], checkIn: ISODate, checkOut: ISODate, bufferDays: number) {
  const end = addDays(checkOut, bufferDays);
  return !occupied.some((r) => r.unitId === unitId && r.startsOn < end && checkIn < r.endsOn);
}

/** wa.me link with the question already written; the visitor sends it from their own phone. */
export function whatsappLink(phone: string, about: { propertyName: string; unitName?: string; stay?: StayQuery }): string {
  const what = about.unitName ? `${about.unitName} en ${about.propertyName}` : about.propertyName;
  const when = about.stay
    ? `, del ${formatDate(about.stay.checkIn)} al ${formatDate(about.stay.checkOut)}, para ${about.stay.guests} ${
        about.stay.guests === 1 ? "huésped" : "huéspedes"
      }`
    : "";
  return `https://wa.me/${phone}?text=${encodeURIComponent(`Hola, quiero consultar por ${what}${when}.`)}`;
}
