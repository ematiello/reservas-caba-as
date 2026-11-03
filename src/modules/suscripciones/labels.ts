import type { Database } from "@/lib/supabase/database.types";

export type SubscriptionStatus = Database["public"]["Enums"]["subscription_status"];
export type PaymentMethodValue = Database["public"]["Enums"]["payment_method"];

export const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  trial: "En prueba",
  active: "Activa",
  past_due: "Vencida (en gracia)",
  suspended: "Suspendida",
  cancelled: "Cancelada",
};

export const METHOD_LABEL: Record<PaymentMethodValue, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  mercadopago: "Mercado Pago",
  other: "Otro",
};

const dateFormat = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeZone: "UTC" });

/** Formats a local YYYY-MM-DD date without shifting it across time zones. */
export function formatDate(date: string): string {
  return dateFormat.format(new Date(`${date}T00:00:00Z`));
}

/** Last paid day: the period end is exclusive. */
export function lastPaidDay(periodEnd: string): string {
  const d = new Date(`${periodEnd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function todayAr(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
}
