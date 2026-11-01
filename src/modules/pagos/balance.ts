// Guest balance (docs/03): total − Σ valid payments. Deposits and payments add to what was paid,
// refunds take it back; voided lines do not count. Integer cents.

export type PaymentKind = "deposit" | "payment" | "refund";

export type PaymentLine = { kind: PaymentKind; amountCents: number; voidedAt: string | null };

export type Balance = {
  paidCents: number;
  /** Null while the booking has no frozen price; negative when the guest overpaid. */
  dueCents: number | null;
};

export function balance(totalCents: number | null, payments: PaymentLine[]): Balance {
  const paidCents = payments.reduce((sum, p) => {
    if (p.voidedAt !== null) return sum;
    return p.kind === "refund" ? sum - p.amountCents : sum + p.amountCents;
  }, 0);
  return { paidCents, dueCents: totalCents === null ? null : totalCents - paidCents };
}
