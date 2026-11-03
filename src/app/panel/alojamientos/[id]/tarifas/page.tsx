import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { AppShell } from "@/components/shell/app-shell";
import { messageFor, Notice } from "@/components/shell/notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { writeAccess } from "@/modules/organizaciones/access";
import { requireActiveMembership } from "@/modules/organizaciones/session";
import { formatDate } from "@/modules/reservas/calendar";
import { formatArs } from "@/modules/suscripciones/billing";
import {
  createDiscountAction,
  createRateAction,
  deleteDiscountAction,
  deleteRateAction,
  updateRateAction,
} from "@/modules/tarifas/actions";
import { DEFAULT_PRIORITY, type RateKind } from "@/modules/tarifas/pricing";
import { getRates, type RateRuleRow } from "@/modules/tarifas/queries";
import { centsToPesosInput, RATE_KINDS } from "@/modules/tarifas/schemas";

import { ReadOnlyNotice, selectClass } from "../../shared";

export const metadata: Metadata = { title: "Tarifas" };

const KIND_LABEL: Record<RateKind, string> = {
  base: "Tarifa base",
  season: "Temporada",
  weekend: "Fin de semana",
  holiday: "Feriado",
  special: "Fecha especial",
};

const WEEKDAY = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const MESSAGES: Record<string, string> = {
  tarifa_creada: "Tarifa agregada.",
  tarifa_guardada: "Tarifa guardada. Las reservas ya registradas conservan su precio.",
  tarifa_borrada: "Tarifa borrada.",
  descuento_creado: "Descuento agregado.",
  descuento_borrado: "Descuento borrado.",
  tarifa_invalida:
    "Revisá la tarifa: nombre, precio por noche, fechas completas y en orden (obligatorias en temporada y fecha especial), y huéspedes incluidos junto con el cargo por adicional.",
  descuento_invalido: "Revisá el descuento: desde 2 noches y entre 1 y 100 %.",
  descuento_repetido: "Ya hay un descuento para esa cantidad de noches.",
  escritura: "No se pudo guardar. Revisá que la cuenta esté activa.",
};

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

type Target = { value: string; label: string };

function RuleFields({ prefix, rule, targets }: { prefix: string; rule?: RateRuleRow; targets: Target[] | null }) {
  const id = (name: string) => `${prefix}-${name}`;
  return (
    <>
      {targets ? (
        <Field id={id("target")} label="Aplica a">
          <select id={id("target")} name="target" required className={selectClass}>
            {targets.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <input type="hidden" name="target" value={rule!.unit_id ? `unit:${rule!.unit_id}` : `category:${rule!.category_id}`} />
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field id={id("kind")} label="Tipo">
          <select id={id("kind")} name="kind" defaultValue={rule?.kind ?? "base"} className={selectClass}>
            {RATE_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field id={id("name")} label="Nombre">
          <Input id={id("name")} name="name" required maxLength={80} defaultValue={rule?.name ?? ""} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field id={id("dateFrom")} label="Desde (opcional)">
          <Input id={id("dateFrom")} name="dateFrom" type="date" defaultValue={rule?.date_from ?? ""} />
        </Field>
        <Field id={id("dateTo")} label="Hasta, inclusive (opcional)">
          <Input id={id("dateTo")} name="dateTo" type="date" defaultValue={rule?.date_to ?? ""} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field id={id("price")} label="Precio por noche ($)">
          <Input id={id("price")} name="price" required inputMode="decimal" defaultValue={centsToPesosInput(rule?.price_cents ?? null)} />
        </Field>
        <Field id={id("minNights")} label="Estadía mínima (opcional)">
          <Input id={id("minNights")} name="minNights" type="number" min={1} max={365} defaultValue={rule?.min_nights ?? ""} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field id={id("guestsIncluded")} label="Huéspedes incluidos (opcional)">
          <Input id={id("guestsIncluded")} name="guestsIncluded" type="number" min={1} max={50} defaultValue={rule?.guests_included ?? ""} />
        </Field>
        <Field id={id("extraGuest")} label="Por huésped adicional, por noche ($)">
          <Input id={id("extraGuest")} name="extraGuest" inputMode="decimal" defaultValue={centsToPesosInput(rule?.extra_guest_cents ?? null)} />
        </Field>
      </div>
      <Field id={id("priority")} label="Prioridad (opcional; vacío = la del tipo)">
        <Input id={id("priority")} name="priority" type="number" min={0} max={1000} defaultValue={rule?.priority ?? ""} />
      </Field>
    </>
  );
}

async function RatesContent({ params, searchParams }: Pick<PageProps<"/panel/alojamientos/[id]/tarifas">, "params" | "searchParams">) {
  const { access, org } = await requireActiveMembership();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [page, query, { writable, canEdit }] = await Promise.all([getRates(org.orgId, id), searchParams, writeAccess(org)]);
  if (!page) notFound();

  const { property, rules, discounts, units, categories } = page;
  const message = messageFor(query, MESSAGES);
  const unitName = new Map(units.map((u) => [u.id, u.name]));
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const targets: Target[] = [
    ...units.map((u) => ({ value: `unit:${u.id}`, label: `Unidad: ${u.name}` })),
    ...categories.map((c) => ({ value: `category:${c.id}`, label: `Categoría: ${c.name}` })),
  ];
  const weekend = property.weekendDays.map((d) => WEEKDAY[d]).join(" y ");

  return (
    <AppShell title={`Tarifas · ${property.name}`} email={access.user.email} showAdminLink={access.isPlatformAdmin}>
      <div className="grid gap-6">
        <Link href={`/panel/alojamientos/${property.id}`} className="text-sm underline underline-offset-4">
          ← Volver al establecimiento
        </Link>
        {writable ? null : <ReadOnlyNotice />}
        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

        <Card>
          <CardHeader>
            <CardTitle>Cómo se calcula</CardTitle>
            <CardDescription>
              Noche por noche gana la regla de mayor prioridad: base 0, temporada 10, fin de semana 20, feriado 30, fecha especial 40 (si
              empatan, la más nueva). Fin de semana: noches del {weekend}. Seña sugerida: {property.depositPct} %. Cambiar una tarifa no
              modifica las reservas ya registradas.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tarifas</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {rules.length ? (
              <ul className="grid gap-3">
                {rules.map((r) => (
                  <li key={r.id} className="rounded-md border p-3 text-sm">
                    <p className="font-medium">
                      {r.name} · {KIND_LABEL[r.kind]} · {formatArs(r.price_cents)} por noche
                    </p>
                    <p className="text-muted-foreground">
                      {r.unit_id ? `Unidad: ${unitName.get(r.unit_id)}` : `Categoría: ${categoryName.get(r.category_id!)}`}
                      {r.date_from ? ` · ${formatDate(r.date_from)} → ${formatDate(r.date_to!)}` : ""}
                      {r.min_nights ? ` · mínimo ${r.min_nights} noches` : ""}
                      {r.guests_included ? ` · incluye ${r.guests_included}, adicional ${formatArs(r.extra_guest_cents!)}` : ""}
                      {` · prioridad ${r.priority ?? DEFAULT_PRIORITY[r.kind]}`}
                    </p>
                    {canEdit ? (
                      <details className="mt-2">
                        <summary className="cursor-pointer underline underline-offset-4">Editar o borrar</summary>
                        <form action={updateRateAction} className="mt-3 grid gap-3">
                          <input type="hidden" name="propertyId" value={property.id} />
                          <input type="hidden" name="ruleId" value={r.id} />
                          <RuleFields prefix={r.id} rule={r} targets={null} />
                          <Button type="submit" variant="outline">
                            Guardar tarifa
                          </Button>
                        </form>
                        <form action={deleteRateAction} className="mt-2">
                          <input type="hidden" name="propertyId" value={property.id} />
                          <input type="hidden" name="ruleId" value={r.id} />
                          <Button type="submit" variant="destructive">
                            Borrar tarifa
                          </Button>
                        </form>
                      </details>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Todavía no hay tarifas: las reservas se registran sin precio hasta que cargues al menos una tarifa base.
              </p>
            )}
          </CardContent>
        </Card>

        {canEdit && targets.length ? (
          <Card>
            <CardHeader>
              <CardTitle>Nueva tarifa</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createRateAction} className="grid gap-3">
                <input type="hidden" name="propertyId" value={property.id} />
                <RuleFields prefix="new" targets={targets} />
                <Button type="submit">Agregar tarifa</Button>
              </form>
            </CardContent>
          </Card>
        ) : null}
        {canEdit && !targets.length ? (
          <p className="text-sm text-muted-foreground">Cargá una unidad para poder ponerle tarifas.</p>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Descuentos por duración</CardTitle>
            <CardDescription>Se aplica el mayor porcentaje cuya cantidad de noches se cumpla, sobre el subtotal.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {discounts.length ? (
              <ul className="grid gap-2">
                {discounts.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>
                      Desde {d.min_nights} noches: {d.pct} %
                    </span>
                    {canEdit ? (
                      <form action={deleteDiscountAction}>
                        <input type="hidden" name="propertyId" value={property.id} />
                        <input type="hidden" name="discountId" value={d.id} />
                        <Button type="submit" variant="outline" size="sm">
                          Borrar
                        </Button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Sin descuentos por duración.</p>
            )}
            {canEdit ? (
              <form action={createDiscountAction} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="propertyId" value={property.id} />
                <Field id="discount-nights" label="Desde (noches)">
                  <Input id="discount-nights" name="minNights" type="number" min={2} max={365} required className="w-28" />
                </Field>
                <Field id="discount-pct" label="Descuento (%)">
                  <Input id="discount-pct" name="pct" type="number" min={1} max={100} required className="w-28" />
                </Field>
                <Button type="submit" variant="outline">
                  Agregar descuento
                </Button>
              </form>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

export default function RatesPage(props: PageProps<"/panel/alojamientos/[id]/tarifas">) {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Cargando…</p>}>
      <RatesContent params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
