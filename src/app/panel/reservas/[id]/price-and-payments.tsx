import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Booking } from "@/modules/reservas/queries";
import { recordPaymentAction, setDepositAction, voidPaymentAction } from "@/modules/pagos/actions";
import { balance } from "@/modules/pagos/balance";
import type { GuestPayment } from "@/modules/pagos/queries";
import { formatDate } from "@/modules/reservas/calendar";
import { priceBookingAction } from "@/modules/reservas/actions";
import { formatArs } from "@/modules/suscripciones/billing";
import { storedQuote } from "@/modules/tarifas/rows";
import { centsToPesosInput } from "@/modules/tarifas/schemas";

import { selectClass } from "../shared";

const PAYMENT_KIND: Record<GuestPayment["kind"], string> = { deposit: "Seña", payment: "Pago", refund: "Devolución" };
const PAYMENT_METHOD: Record<GuestPayment["method"], string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  mercadopago: "Mercado Pago",
  other: "Otro",
};

type Props = {
  booking: Booking;
  payments: GuestPayment[];
  writable: boolean;
  canEdit: boolean;
  today: string;
  timeZone: string;
};

export function PriceAndPayments({ booking, payments, writable, canEdit, today, timeZone }: Props) {
  const quote = storedQuote(booking.price_breakdown);
  const { paidCents, dueCents } = balance(booking.total_cents, payments.map((p) => ({ kind: p.kind, amountCents: p.amount_cents, voidedAt: p.voided_at })));
  const paidOn = (iso: string) => new Intl.DateTimeFormat("es-AR", { timeZone, dateStyle: "short" }).format(new Date(iso));

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Precio</CardTitle>
          {booking.total_cents !== null ? (
            <CardDescription>Congelado al registrar la reserva: cambiar las tarifas no lo modifica.</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          {booking.total_cents === null ? (
            <>
              <p data-testid="booking-total">Sin precio: no había tarifa para todas las noches cuando se registró.</p>
              {writable ? (
                <form action={priceBookingAction}>
                  <input type="hidden" name="bookingId" value={booking.id} />
                  <Button type="submit" variant="outline">
                    Calcular precio con las tarifas actuales
                  </Button>
                </form>
              ) : null}
            </>
          ) : (
            <>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                {quote && quote.discountCents > 0 ? (
                  <>
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd>{formatArs(quote.subtotalCents)}</dd>
                    <dt className="text-muted-foreground">Descuento por duración</dt>
                    <dd>
                      −{formatArs(quote.discountCents)} ({quote.discountPct} %)
                    </dd>
                  </>
                ) : null}
                <dt className="text-muted-foreground">Total</dt>
                <dd className="font-medium" data-testid="booking-total">
                  {formatArs(booking.total_cents)}
                </dd>
                <dt className="text-muted-foreground">Seña</dt>
                <dd data-testid="booking-deposit">{formatArs(booking.deposit_cents ?? 0)}</dd>
                <dt className="text-muted-foreground">Pagado</dt>
                <dd>{formatArs(paidCents)}</dd>
                <dt className="text-muted-foreground">{dueCents !== null && dueCents < 0 ? "A devolver" : "Saldo"}</dt>
                <dd className="font-medium" data-testid="booking-balance">
                  {formatArs(Math.abs(dueCents ?? 0))}
                </dd>
              </dl>
              {quote ? (
                <details>
                  <summary className="cursor-pointer underline underline-offset-4">Desglose por noche</summary>
                  <ul className="mt-2 grid gap-1">
                    {quote.nights.map((n) => (
                      <li key={n.date}>
                        {formatDate(n.date)} · {n.ruleName}: {formatArs(n.baseCents)}
                        {n.extraGuests ? ` + ${n.extraGuests} adicional(es) ${formatArs(n.extraCents)}` : ""}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
              {canEdit ? (
                <form action={setDepositAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="bookingId" value={booking.id} />
                  <div className="grid gap-1.5">
                    <Label htmlFor="deposit">Ajustar seña ($)</Label>
                    <Input
                      id="deposit"
                      name="deposit"
                      inputMode="decimal"
                      required
                      className="w-36"
                      defaultValue={centsToPesosInput(booking.deposit_cents)}
                    />
                  </div>
                  <Button type="submit" variant="outline">
                    Guardar seña
                  </Button>
                </form>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Card id="pagos">
        <CardHeader>
          <CardTitle>Pagos</CardTitle>
          <CardDescription>Registrados a mano. Un pago anulado queda a la vista pero no cuenta.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm">
          {payments.length ? (
            <ul className="grid gap-2" aria-label="Pagos registrados">
              {payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className={p.voided_at ? "text-muted-foreground line-through" : ""}>
                    {paidOn(p.paid_at)} · {PAYMENT_KIND[p.kind]} · {PAYMENT_METHOD[p.method]} · {p.kind === "refund" ? "−" : ""}
                    {formatArs(p.amount_cents)}
                    {p.reference ? ` · ${p.reference}` : ""}
                  </span>
                  {p.voided_at ? <span className="text-muted-foreground">(anulado)</span> : null}
                  {canEdit && !p.voided_at ? (
                    <form action={voidPaymentAction}>
                      <input type="hidden" name="bookingId" value={booking.id} />
                      <input type="hidden" name="paymentId" value={p.id} />
                      <Button type="submit" variant="outline" size="sm">
                        Anular
                      </Button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">Todavía no hay pagos.</p>
          )}

          {writable ? (
            <form action={recordPaymentAction} className="grid gap-3">
              <input type="hidden" name="bookingId" value={booking.id} />
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="payKind">Concepto</Label>
                  <select id="payKind" name="kind" defaultValue={paidCents > 0 ? "payment" : "deposit"} className={selectClass}>
                    <option value="deposit">Seña</option>
                    <option value="payment">Pago</option>
                    {canEdit ? <option value="refund">Devolución</option> : null}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="payMethod">Medio</Label>
                  <select id="payMethod" name="method" defaultValue="transfer" className={selectClass}>
                    {Object.entries(PAYMENT_METHOD).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="payAmount">Importe ($)</Label>
                  <Input id="payAmount" name="amount" inputMode="decimal" required />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="payDate">Fecha</Label>
                  <Input id="payDate" name="paidOn" type="date" required defaultValue={today} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="payReference">Referencia (opcional)</Label>
                <Input id="payReference" name="reference" maxLength={200} autoComplete="off" />
              </div>
              <Button type="submit">Registrar pago</Button>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}
