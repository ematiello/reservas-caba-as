import { z } from "zod";

// Amounts are typed in pesos by the admin and stored as integer cents.
// Accepts "12000", "12.000" (thousands), "12.345,50" (es-AR) and "12345.50".
export function parsePesosToCents(input: string): number | null {
  const s = input.replace(/[\s$]/g, "");
  if (!s) return null;
  let normalized: string;
  if (s.includes(",")) {
    // es-AR: "." groups thousands, "," is the decimal separator.
    if (!/^\d{1,3}(\.\d{3})*,\d{1,2}$|^\d+,\d{1,2}$/.test(s)) return null;
    normalized = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    normalized = s.replace(/\./g, "");
  } else if (/^\d+(\.\d{1,2})?$/.test(s)) {
    normalized = s;
  } else {
    return null;
  }
  return Math.round(Number(normalized) * 100);
}

const pesos = (message: string) =>
  z
    .string()
    .transform((value, ctx) => {
      const cents = parsePesosToCents(value);
      if (cents === null) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return cents;
    });

const intInRange = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, message)
    .transform(Number)
    .pipe(z.number().int().min(min, message).max(max, message));

// Empty = unlimited.
const optionalLimit = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === "") return null;
    if (!/^\d+$/.test(value) || Number(value) < 1) {
      ctx.addIssue({ code: "custom", message: "Ingresá un número mayor que cero o dejalo vacío." });
      return z.NEVER;
    }
    return Number(value);
  });

const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ingresá una fecha válida.");

export const planSchema = z
  .object({
    name: z.string().trim().min(2, "Ingresá un nombre.").max(60, "El nombre es demasiado largo."),
    price: pesos("Ingresá un precio válido, por ejemplo 15.000 o 15000,50."),
    maxUnits: optionalLimit,
    maxMembers: optionalLimit,
    isActive: z.string().optional(),
  })
  .transform(({ price, isActive, ...rest }) => ({ ...rest, priceCents: price, isActive: isActive === "on" }));

export const settingsSchema = z.object({
  trialDays: intInRange(1, 90, "Entre 1 y 90 días."),
  graceDays: intInRange(0, 60, "Entre 0 y 60 días."),
});

export const PAYMENT_METHODS = ["cash", "transfer", "mercadopago", "other"] as const;

export const paymentSchema = z
  .object({
    orgId: z.uuid(),
    amount: pesos("Ingresá un importe válido."),
    method: z.enum(PAYMENT_METHODS, "Elegí un medio de pago."),
    paidAt: localDate,
    months: intInRange(1, 24, "Entre 1 y 24 meses."),
    notes: z.string().trim().max(500, "Máximo 500 caracteres."),
  })
  .transform(({ amount, notes, ...rest }) => ({ ...rest, amountCents: amount, notes: notes || null }));

export const subscriptionSettingsSchema = z.object({
  orgId: z.uuid(),
  planId: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
  graceDays: intInRange(0, 60, "Entre 0 y 60 días."),
});

export const discountSchema = z
  .object({
    orgId: z.uuid(),
    kind: z.enum(["none", "pct", "cents"]),
    value: z.string().trim(),
    until: z.union([localDate, z.literal("")]),
  })
  .transform(({ orgId, kind, value, until }, ctx) => {
    if (kind === "none") return { orgId, pct: null, cents: null, until: null };
    if (kind === "pct") {
      const pct = Number(value.replace(",", "."));
      if (!/^\d+([.,]\d{1,2})?$/.test(value) || pct <= 0 || pct > 100) {
        ctx.addIssue({ code: "custom", path: ["value"], message: "Ingresá un porcentaje entre 0 y 100." });
        return z.NEVER;
      }
      return { orgId, pct, cents: null, until: until || null };
    }
    const cents = parsePesosToCents(value);
    if (cents === null || cents <= 0) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "Ingresá un importe mayor que cero." });
      return z.NEVER;
    }
    return { orgId, pct: null, cents, until: until || null };
  });

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
