import { z } from "zod";

import { isISODate } from "@/modules/reservas/calendar";
import { parsePesosToCents } from "@/modules/suscripciones/schemas";

// Guest payments are typed in pesos (es-AR) and stored as integer cents. Shared by the forms and
// their server actions; the database checks them again (amount > 0, kinds, who may refund or void).

export const GUEST_PAYMENT_KINDS = ["deposit", "payment", "refund"] as const;
export const GUEST_PAYMENT_METHODS = ["cash", "transfer", "mercadopago", "other"] as const;

const cents = (min: number, message: string) =>
  z.string().transform((value, ctx) => {
    const parsed = parsePesosToCents(value);
    if (parsed === null || parsed < min) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return parsed;
  });

export const guestPaymentSchema = z
  .object({
    bookingId: z.uuid(),
    kind: z.enum(GUEST_PAYMENT_KINDS),
    method: z.enum(GUEST_PAYMENT_METHODS),
    amount: cents(1, "Ingresá un importe mayor a cero."),
    paidOn: z.string().trim().refine(isISODate, "Fecha inválida."),
    reference: z.string().trim().max(200),
  })
  .transform(({ amount, ...rest }) => ({ ...rest, amountCents: amount }));

export const depositSchema = z
  .object({ bookingId: z.uuid(), deposit: cents(0, "Ingresá una seña válida.") })
  .transform(({ bookingId, deposit }) => ({ bookingId, depositCents: deposit }));

export const voidSchema = z.object({ bookingId: z.uuid(), paymentId: z.uuid() });
