import { z } from "zod";

import { isISODate } from "@/modules/reservas/calendar";
import { parsePesosToCents } from "@/modules/suscripciones/schemas";

// Shared by the rate forms and their server actions. Same rules and technical caps as the database
// checks (docs/05 D25, odd/tasks/fase-5 L3); amounts typed in pesos are stored as cents.

export const RATE_KINDS = ["base", "season", "weekend", "holiday", "special"] as const;

/** Cents as the pesos a form shows ("15000,50"), which parsePesosToCents reads back unchanged. */
export function centsToPesosInput(cents: number | null): string {
  if (cents === null) return "";
  const pesos = Math.floor(cents / 100);
  const rest = cents % 100;
  return rest ? `${pesos},${String(rest).padStart(2, "0")}` : String(pesos);
}

const optionalDate = z
  .string()
  .trim()
  .transform((v) => v || null)
  .refine((v) => v === null || isISODate(v), "Fecha inválida.");

const optionalInt = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (!v) return null;
      const n = /^\d+$/.test(v) ? Number(v) : NaN;
      if (!(n >= min && n <= max)) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return n;
    });

const pesos = (message: string) =>
  z.string().transform((v, ctx) => {
    const cents = parsePesosToCents(v);
    if (cents === null) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return cents;
  });

const optionalPesos = (message: string) =>
  z.string().transform((v, ctx) => {
    if (!v.trim()) return null;
    const cents = parsePesosToCents(v);
    if (cents === null) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return cents;
  });

const target = z.string().transform((v, ctx) => {
  const [kind, id] = v.split(":");
  if ((kind === "unit" || kind === "category") && z.uuid().safeParse(id).success) {
    return kind === "unit" ? { unitId: id, categoryId: null } : { unitId: null, categoryId: id };
  }
  ctx.addIssue({ code: "custom", message: "Elegí una unidad o categoría." });
  return z.NEVER;
});

export const rateRuleSchema = z
  .object({
    target,
    kind: z.enum(RATE_KINDS),
    name: z.string().trim().min(1, "Poné un nombre.").max(80),
    dateFrom: optionalDate,
    dateTo: optionalDate,
    price: pesos("Ingresá un precio por noche."),
    guestsIncluded: optionalInt(1, 50, "Entre 1 y 50 huéspedes."),
    extraGuest: optionalPesos("Importe por huésped adicional inválido."),
    minNights: optionalInt(1, 365, "Estadía mínima entre 1 y 365 noches."),
    priority: optionalInt(0, 1000, "Prioridad entre 0 y 1000."),
  })
  .refine((r) => (r.dateFrom === null) === (r.dateTo === null), { message: "Completá las dos fechas o ninguna.", path: ["dateTo"] })
  .refine((r) => r.dateFrom === null || r.dateTo === null || r.dateTo >= r.dateFrom, {
    message: "La fecha final no puede ser anterior a la inicial.",
    path: ["dateTo"],
  })
  .refine((r) => !(r.kind === "season" || r.kind === "special") || r.dateFrom !== null, {
    message: "Las temporadas y fechas especiales necesitan fechas.",
    path: ["dateFrom"],
  })
  .refine((r) => (r.guestsIncluded === null) === (r.extraGuest === null), {
    message: "Huéspedes incluidos y cargo por adicional van juntos.",
    path: ["extraGuest"],
  })
  .transform(({ target: t, price, extraGuest, ...rest }) => ({
    ...t,
    kind: rest.kind,
    name: rest.name,
    dateFrom: rest.dateFrom,
    dateTo: rest.dateTo,
    priceCents: price,
    guestsIncluded: rest.guestsIncluded,
    extraGuestCents: extraGuest,
    minNights: rest.minNights,
    priority: rest.priority,
  }));

const int = (min: number, max: number, message: string) =>
  z.string().trim().regex(/^\d+$/, message).transform(Number).pipe(z.number().int().min(min, message).max(max, message));

export const holidaySchema = z.object({
  date: z.string().trim().refine(isISODate, "Fecha inválida."),
  name: z.string().trim().min(1, "Poné un nombre.").max(80),
});

export const discountSchema = z.object({
  minNights: int(2, 365, "Desde 2 noches."),
  pct: int(1, 100, "Entre 1 y 100 %."),
});
