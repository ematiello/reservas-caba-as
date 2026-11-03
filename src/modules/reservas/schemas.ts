import { z } from "zod";

import { isISODate } from "./calendar";

// Shared by the booking forms and their server actions. The database enforces the same rules
// again (capacity, overlaps, transitions); these only give early, readable errors.

const date = z.string().trim().refine(isISODate, "Fecha inválida.");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

// Same cap as units.max_guests (docs/05, D25).
const guests = z.string().trim().regex(/^\d+$/, "Entre 1 y 50 huéspedes.").transform(Number).pipe(z.number().int().min(1).max(50));

const target = z
  .string()
  .transform((v, ctx) => {
    const [kind, id] = v.split(":");
    if ((kind === "unit" || kind === "category") && z.uuid().safeParse(id).success) return { kind, id } as const;
    ctx.addIssue({ code: "custom", message: "Elegí una unidad o categoría." });
    return z.NEVER;
  });

function stayDates<T extends { checkIn: string; checkOut: string }>(value: T) {
  return value.checkOut > value.checkIn;
}

const STAY_MESSAGE = { message: "La salida tiene que ser posterior al ingreso.", path: ["checkOut"] };

export const BOOKING_STATUSES_ON_CREATE = ["provisional", "confirmed"] as const;

export const bookingSchema = z
  .object({
    target,
    checkIn: date,
    checkOut: date,
    guestsCount: guests,
    guestName: z.string().trim().min(1, "Ingresá el nombre del huésped.").max(120),
    guestPhone: optionalText(40),
    guestEmail: z
      .string()
      .trim()
      .max(200)
      .transform((v) => v || null)
      .pipe(z.email("Email inválido.").nullable()),
    status: z.enum(BOOKING_STATUSES_ON_CREATE),
    notes: z.string().trim().max(2000),
  })
  .refine(stayDates, STAY_MESSAGE);

export const blockSchema = z
  .object({ unitId: z.uuid(), checkIn: date, checkOut: date, notes: z.string().trim().max(2000) })
  .refine(stayDates, STAY_MESSAGE);

export const STATUS_ACTIONS = ["confirmed", "checked_in", "checked_out", "cancelled"] as const;

export const statusSchema = z.object({ bookingId: z.uuid(), status: z.enum(STATUS_ACTIONS) });

export const moveSchema = z
  // Blocks hold no guests, so their move form leaves the count out.
  .object({ bookingId: z.uuid(), unitId: z.uuid(), checkIn: date, checkOut: date, guestsCount: guests.optional() })
  .refine(stayDates, STAY_MESSAGE);
