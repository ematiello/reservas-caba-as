// Subscription billing helpers. Amounts are integer cents in ARS; dates are local YYYY-MM-DD strings.

// The database allows a percentage or a fixed amount, never both; if both arrive, the percentage wins.
export type Discount = {
  pct: number | null;
  cents: number | null;
  /** Last day the discount applies (inclusive); null = no end. */
  until: string | null;
};

/** Suggested amount to charge for one month on `today`, after the organization's discount. */
export function amountDue(priceCents: number, discount: Discount, today: string): number {
  const live = discount.until === null || today <= discount.until;
  if (!live) return priceCents;
  if (discount.pct !== null) return priceCents - Math.round((priceCents * discount.pct) / 100);
  if (discount.cents !== null) return Math.max(0, priceCents - discount.cents);
  return priceCents;
}

const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

export function formatArs(cents: number): string {
  return ars.format(cents / 100);
}
