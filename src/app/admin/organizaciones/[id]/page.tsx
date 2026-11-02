import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { AppShell } from "@/components/shell/app-shell";
import { messageFor, Notice } from "@/components/shell/notice";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { selectClass } from "@/components/ui/native-controls";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  adminCancelSubscriptionAction,
  adminUpdateOrganizationAction,
  reactivateSubscriptionAction,
  setOrganizationDisabledAction,
} from "@/modules/organizaciones/admin-actions";
import { requirePlatformAdmin } from "@/modules/organizaciones/session";
import { addDays } from "@/modules/reservas/calendar";
import {
  recordPaymentAction,
  suspendSubscriptionAction,
  updateDiscountAction,
  updateSubscriptionAction,
} from "@/modules/suscripciones/actions";
import { amountDue, formatArs } from "@/modules/suscripciones/billing";
import { formatDate, lastPaidDay, METHOD_LABEL, STATUS_LABEL, todayAr } from "@/modules/suscripciones/labels";
import { getOrgBilling, listPlans } from "@/modules/suscripciones/queries";
import { PAYMENT_METHODS } from "@/modules/suscripciones/schemas";

export const metadata: Metadata = { title: "Organización" };

const MESSAGES: Record<string, string> = {
  pago: "Pago registrado. El período se extendió.",
  suscripcion: "Plan y días de gracia guardados.",
  descuento: "Descuento guardado.",
  suspension: "Cuenta suspendida. Queda en solo lectura hasta que registres un pago.",
  pago_invalido: "Revisá el pago: importe (por ejemplo 15.000), medio, fecha y meses entre 1 y 24.",
  pago_error: "No se pudo registrar el pago.",
  suscripcion_invalida: "Los días de gracia van de 0 a 60.",
  suscripcion_error: "No se pudo guardar la suscripción.",
  descuento_invalido: "Revisá el descuento: porcentaje entre 0 y 100 o importe mayor que cero.",
  descuento_error: "No se pudo guardar el descuento.",
  suspension_error: "No se pudo suspender: la cuenta ya está suspendida o cancelada.",
  organizacion: "Datos de la organización guardados.",
  organizacion_invalida: "Revisá el nombre y la dirección pública (al menos 3 letras o números, sin palabras reservadas).",
  direccion_en_uso: "Esa dirección pública ya está en uso. Elegí otra.",
  organizacion_error: "No se pudieron guardar los datos de la organización.",
  desactivada: "Organización desactivada: su panel queda en solo lectura y la página pública no está disponible.",
  activada: "Organización activada de nuevo.",
  confirmar_desactivar: "Marcá la confirmación para desactivar la organización.",
  desactivar_error: "No se pudo cambiar el estado de la organización.",
  baja: "Suscripción dada de baja. La cuenta queda en solo lectura y los datos se conservan.",
  confirmar_baja: "Marcá la confirmación para dar de baja la suscripción.",
  baja_error: "No se pudo dar de baja: la suscripción ya está suspendida o dada de baja.",
  reactivada: "Cuenta reactivada hasta la fecha elegida.",
  reactivacion_fecha: "Elegí un último día activo desde hoy y dentro de los próximos dos años.",
  reactivacion_error: "No se pudo reactivar la cuenta.",
};


function pesos(cents: number) {
  return (cents / 100).toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

async function OrgContent({ params, searchParams }: Pick<PageProps<"/admin/organizaciones/[id]">, "params" | "searchParams">) {
  await requirePlatformAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [billing, plans, query] = await Promise.all([getOrgBilling(id), listPlans(), searchParams]);
  if (!billing) notFound();

  const { org, subscription: sub, plan, payments } = billing;
  const today = todayAr();
  const message = messageFor(query, MESSAGES);
  const discount = sub ? { pct: sub.discount_pct, cents: sub.discount_cents, until: sub.discount_until } : null;
  const suggested = plan && discount ? amountDue(plan.price_cents, discount, today) : null;
  const discountKind = sub?.discount_pct ? "pct" : sub?.discount_cents ? "cents" : "none";

  return (
    <AppShell title={org.name}>
      <div className="grid gap-6">
        <Link href="/admin" className="text-sm underline underline-offset-4">
          ← Volver a administración
        </Link>
        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
        {org.disabled_at ? (
          <Notice tone="error">
            Organización desactivada desde el {formatDate(org.disabled_at.slice(0, 10))}: panel en solo lectura y página
            pública no disponible. Registrar un pago no la vuelve a activar.
          </Notice>
        ) : null}

        <nav aria-label="Operación de la organización" className="flex flex-wrap gap-2">
          <Link href={`/admin/organizaciones/${org.id}/reservas`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Ver reservas
          </Link>
          <Link href={`/admin/organizaciones/${org.id}/huespedes`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Ver huéspedes
          </Link>
          <Link href={`/admin/actividad?org=${org.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Ver actividad
          </Link>
        </nav>

        <Card>
          <CardHeader>
            <CardTitle>Datos de la organización</CardTitle>
            <CardDescription>
              Cambiar la dirección pública rompe los enlaces que ya se compartieron con la anterior.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={adminUpdateOrganizationAction} className="grid gap-3 sm:grid-cols-3 sm:items-end">
              <input type="hidden" name="orgId" value={org.id} />
              <div className="grid gap-1.5">
                <Label htmlFor="orgName">Nombre</Label>
                <Input id="orgName" name="orgName" defaultValue={org.name} maxLength={120} required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="slug">Dirección pública</Label>
                <Input id="slug" name="slug" defaultValue={org.slug} maxLength={40} required />
              </div>
              <Button type="submit">Guardar datos</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{org.disabled_at ? "Activar organización" : "Desactivar organización"}</CardTitle>
            <CardDescription>
              {org.disabled_at
                ? "Vuelve a habilitar el panel y la página pública según el estado de su suscripción."
                : "Independiente del cobro: el panel queda en solo lectura, la página pública no disponible y los datos se conservan."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={setOrganizationDisabledAction} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="orgId" value={org.id} />
              <input type="hidden" name="disabled" value={org.disabled_at ? "false" : "true"} />
              {org.disabled_at ? (
                <Button type="submit">Activar</Button>
              ) : (
                <>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="confirm" required />
                    Quiero desactivar esta organización
                  </label>
                  <Button type="submit" variant="destructive">
                    Desactivar
                  </Button>
                </>
              )}
            </form>
          </CardContent>
        </Card>

        {!sub ? (
          <Notice tone="warning">Esta organización no tiene suscripción (todavía no fue aprobada).</Notice>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Estado: {STATUS_LABEL[sub.status]}</CardTitle>
                <CardDescription>
                  /{org.slug} · Plan: {plan ? `${plan.name} (${formatArs(plan.price_cents)}/mes)` : "sin asignar"}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-1 text-sm">
                <p>
                  Período: {formatDate(sub.current_period_start)} al {formatDate(lastPaidDay(sub.current_period_end))}
                </p>
                <p>Días de gracia: {sub.grace_days}</p>
                {sub.trial_ends_at ? <p>Prueba hasta: {formatDate(lastPaidDay(sub.trial_ends_at))}</p> : null}
                {sub.discount_pct || sub.discount_cents ? (
                  <p>
                    Descuento: {sub.discount_pct ? `${sub.discount_pct}%` : formatArs(sub.discount_cents ?? 0)}
                    {sub.discount_until ? ` hasta ${formatDate(sub.discount_until)}` : " sin vencimiento"}
                  </p>
                ) : null}
                {suggested !== null ? <p className="font-medium">Importe sugerido hoy: {formatArs(suggested)}</p> : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Registrar pago</CardTitle>
                <CardDescription>
                  Con la cuenta al día, el período sigue desde su fin. Si está suspendida o pasó la gracia, arranca el día
                  del pago y la cuenta se reactiva.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={recordPaymentAction} className="grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="orgId" value={org.id} />
                  <div className="grid gap-1.5">
                    <Label htmlFor="amount">Importe (ARS)</Label>
                    <Input
                      id="amount"
                      name="amount"
                      inputMode="decimal"
                      defaultValue={suggested !== null ? pesos(suggested) : ""}
                      required
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="method">Medio</Label>
                    <select id="method" name="method" defaultValue="transfer" className={selectClass}>
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {METHOD_LABEL[m]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="paidAt">Fecha del pago</Label>
                    <Input id="paidAt" name="paidAt" type="date" defaultValue={today} required />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="months">Meses que cubre</Label>
                    <Input id="months" name="months" inputMode="numeric" defaultValue="1" required />
                  </div>
                  <div className="grid gap-1.5 sm:col-span-2">
                    <Label htmlFor="notes">Notas</Label>
                    <Input id="notes" name="notes" maxLength={500} placeholder="Referencia de la transferencia, etc." />
                  </div>
                  <div className="sm:col-span-2">
                    <Button type="submit">Registrar pago</Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Plan y días de gracia</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={updateSubscriptionAction} className="grid gap-3 sm:grid-cols-3 sm:items-end">
                  <input type="hidden" name="orgId" value={org.id} />
                  <div className="grid gap-1.5">
                    <Label htmlFor="planId">Plan</Label>
                    <select id="planId" name="planId" defaultValue={sub.plan_id ?? ""} className={selectClass}>
                      <option value="">Sin plan</option>
                      {plans
                        .filter((p) => p.is_active || p.id === sub.plan_id)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} · {formatArs(p.price_cents)}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="graceDays">Días de gracia</Label>
                    <Input id="graceDays" name="graceDays" inputMode="numeric" defaultValue={sub.grace_days} required />
                  </div>
                  <Button type="submit">Guardar</Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Descuento</CardTitle>
                <CardDescription>Porcentaje o monto fijo por mes, con fecha de fin opcional (inclusive).</CardDescription>
              </CardHeader>
              <CardContent>
                <form action={updateDiscountAction} className="grid gap-3 sm:grid-cols-4 sm:items-end">
                  <input type="hidden" name="orgId" value={org.id} />
                  <div className="grid gap-1.5">
                    <Label htmlFor="kind">Tipo</Label>
                    <select id="kind" name="kind" defaultValue={discountKind} className={selectClass}>
                      <option value="none">Sin descuento</option>
                      <option value="pct">Porcentaje</option>
                      <option value="cents">Monto fijo (ARS)</option>
                    </select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="value">Valor</Label>
                    <Input
                      id="value"
                      name="value"
                      inputMode="decimal"
                      defaultValue={sub.discount_pct ?? (sub.discount_cents ? pesos(sub.discount_cents) : "")}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="until">Hasta</Label>
                    <Input id="until" name="until" type="date" defaultValue={sub.discount_until ?? ""} />
                  </div>
                  <Button type="submit">Guardar descuento</Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Reactivar sin pago</CardTitle>
                <CardDescription>
                  Deja la suscripción activa desde hoy hasta el día que elijas (inclusive), sin registrar un pago. Sirve
                  para una cuenta suspendida, vencida o dada de baja, o para extender una prueba.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={reactivateSubscriptionAction} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="orgId" value={org.id} />
                  <div className="grid gap-1.5">
                    <Label htmlFor="reactivateUntil">Último día activo</Label>
                    <Input
                      id="reactivateUntil"
                      name="until"
                      type="date"
                      min={today}
                      max={addDays(today, 730)}
                      defaultValue={addDays(today, 30)}
                      required
                    />
                  </div>
                  <Button type="submit">Reactivar</Button>
                </form>
              </CardContent>
            </Card>

            {sub.status === "suspended" || sub.status === "cancelled" ? null : (
              <Card>
                <CardHeader>
                  <CardTitle>Suspender cuenta</CardTitle>
                  <CardDescription>
                    El panel queda en solo lectura y los datos se conservan. Se reactiva al registrar un pago o con
                    &quot;Reactivar sin pago&quot;.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form action={suspendSubscriptionAction}>
                    <input type="hidden" name="orgId" value={org.id} />
                    <Button type="submit" variant="destructive">
                      Suspender
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {sub.status === "cancelled" ? null : (
              <Card>
                <CardHeader>
                  <CardTitle>Dar de baja la suscripción</CardTitle>
                  <CardDescription>
                    La cuenta pasa a solo lectura y la página pública no está disponible. Los datos se conservan y se
                    puede volver con &quot;Reactivar sin pago&quot; o registrando un pago.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form action={adminCancelSubscriptionAction} className="flex flex-wrap items-center gap-3">
                    <input type="hidden" name="orgId" value={org.id} />
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="confirm" required />
                      Quiero dar de baja esta suscripción
                    </label>
                    <Button type="submit" variant="destructive">
                      Dar de baja
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Pagos ({payments.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {payments.length ? (
                  <ul className="divide-y text-sm">
                    {payments.map((p) => (
                      <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2">
                        <span>
                          {formatDate(p.paid_at)} · {METHOD_LABEL[p.method]} · {formatArs(p.amount_cents)}
                        </span>
                        <span className="text-muted-foreground">
                          Cubre {formatDate(p.period_start)} al {formatDate(lastPaidDay(p.period_end))}
                          {p.notes ? ` · ${p.notes}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Todavía no hay pagos registrados.</p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}

export default function OrgSubscriptionPage(props: PageProps<"/admin/organizaciones/[id]">) {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Cargando…</p>}>
      <OrgContent params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
