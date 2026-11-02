import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { messageFor, Notice } from "@/components/shell/notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cancelSubscriptionAction } from "@/modules/organizaciones/manage-actions";
import { requireOwnerAccess } from "@/modules/organizaciones/session";
import { amountDue, formatArs } from "@/modules/suscripciones/billing";
import { formatDate, lastPaidDay, METHOD_LABEL, STATUS_LABEL, todayAr } from "@/modules/suscripciones/labels";
import { getOrgBilling } from "@/modules/suscripciones/queries";

export const metadata: Metadata = { title: "Suscripción" };

const MESSAGES: Record<string, string> = {
  baja: "Diste de baja la suscripción. La cuenta queda en solo lectura y tus datos se conservan.",
  confirmar_baja: "Marcá la confirmación para dar de baja la suscripción.",
  baja_error: "No se pudo dar de baja la suscripción. Intentá de nuevo.",
};

async function SubscriptionContent({ searchParams }: Pick<PageProps<"/panel/suscripcion">, "searchParams">) {
  // Owner only (docs/01: only the owner sees the platform subscription and payments). RLS agrees.
  // A suspended account still reaches this page: suspension is a subscription state, not an org state.
  const { org } = await requireOwnerAccess();
  const [billing, query] = await Promise.all([getOrgBilling(org.orgId), searchParams]);
  const message = messageFor(query, MESSAGES);
  const sub = billing?.subscription ?? null;
  const plan = billing?.plan ?? null;
  const today = todayAr();

  return (
    <AppShell title="Suscripción">
      <div className="grid gap-6">
        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
        {!sub ? (
          <Notice tone="warning">Tu cuenta todavía no tiene una suscripción asignada.</Notice>
        ) : (
          <>
            {sub.status === "cancelled" ? (
              <Notice tone="error">
                La suscripción está dada de baja: el panel queda en solo lectura y tus datos se conservan. Para volver,
                comunicate con el administrador de la plataforma.
              </Notice>
            ) : sub.status === "suspended" ? (
              <Notice tone="error">
                Tu cuenta está suspendida: el panel queda en solo lectura y tus datos se conservan. Para reactivarla,
                comunicate con el administrador de la plataforma.
              </Notice>
            ) : sub.status === "past_due" ? (
              <Notice tone="warning">
                Tu suscripción está vencida. Tenés {sub.grace_days} días de gracia desde el vencimiento antes de que la
                cuenta quede en solo lectura.
              </Notice>
            ) : null}
            <Card>
              <CardHeader>
                <CardTitle>
                  {billing!.org.name} · {STATUS_LABEL[sub.status]}
                </CardTitle>
                <CardDescription>
                  Plan: {plan ? `${plan.name} (${formatArs(plan.price_cents)} por mes)` : "a definir con el administrador"}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-1 text-sm">
                <p>
                  {sub.status === "trial" ? "Prueba gratuita" : "Período pago"}: hasta el{" "}
                  {formatDate(lastPaidDay(sub.current_period_end))}
                </p>
                {plan ? (
                  <p>
                    Próximo importe:{" "}
                    {formatArs(
                      amountDue(plan.price_cents, { pct: sub.discount_pct, cents: sub.discount_cents, until: sub.discount_until }, today),
                    )}
                  </p>
                ) : null}
                {plan?.max_members ? <p>Integrantes incluidos: hasta {plan.max_members}</p> : null}
                {plan?.max_units ? <p>Unidades incluidas: hasta {plan.max_units}</p> : null}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Pagos</CardTitle>
              </CardHeader>
              <CardContent>
                {billing!.payments.length ? (
                  <ul className="divide-y text-sm">
                    {billing!.payments.map((p) => (
                      <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2">
                        <span>
                          {formatDate(p.paid_at)} · {METHOD_LABEL[p.method]} · {formatArs(p.amount_cents)}
                        </span>
                        <span className="text-muted-foreground">
                          Cubre hasta el {formatDate(lastPaidDay(p.period_end))}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Todavía no hay pagos registrados.</p>
                )}
              </CardContent>
            </Card>
            {sub.status === "trial" || sub.status === "active" || sub.status === "past_due" ? (
              <Card>
                <CardHeader>
                  <CardTitle>Dar de baja la suscripción</CardTitle>
                  <CardDescription>
                    La cuenta pasa a solo lectura y la página pública muestra que no está disponible. Tus datos se
                    conservan y el administrador de la plataforma puede reactivarla.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form action={cancelSubscriptionAction} className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="confirm" required />
                      Quiero dar de baja la suscripción
                    </label>
                    <Button type="submit" variant="destructive">
                      Dar de baja
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}

export default function SubscriptionPage(props: PageProps<"/panel/suscripcion">) {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Cargando…</p>}>
      <SubscriptionContent searchParams={props.searchParams} />
    </Suspense>
  );
}
