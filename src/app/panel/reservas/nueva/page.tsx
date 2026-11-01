import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { messageFor, Notice } from "@/components/shell/notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { writeAccess } from "@/modules/organizaciones/access";
import { requireActiveMembership } from "@/modules/organizaciones/session";
import { createBlockAction, createBookingAction } from "@/modules/reservas/actions";
import { addDays, isISODate, todayIn } from "@/modules/reservas/calendar";
import { listBookableUnits, listPropertyOptions } from "@/modules/reservas/queries";

import { MESSAGES, ReadOnlyNotice, selectClass, textareaClass } from "../shared";

export const metadata: Metadata = { title: "Nueva reserva" };

type Query = Awaited<PageProps<"/panel/reservas/nueva">["searchParams"]>;

const one = (query: Query, key: string) => (typeof query[key] === "string" ? (query[key] as string) : undefined);

async function NewBookingContent({ searchParams }: Pick<PageProps<"/panel/reservas/nueva">, "searchParams">) {
  const { access, org } = await requireActiveMembership();
  const [query, properties, { writable }] = await Promise.all([searchParams, listPropertyOptions(org.orgId), writeAccess(org)]);
  const message = messageFor(query, MESSAGES);
  const property = properties.find((p) => p.id === one(query, "property")) ?? properties[0];
  const back = property ? `/panel/reservas?property=${property.id}` : "/panel/reservas";

  if (!property) {
    return (
      <AppShell title="Nueva reserva" email={access.user.email} showAdminLink={access.isPlatformAdmin}>
        <p className="text-sm">
          Primero cargá un establecimiento en{" "}
          <Link href="/panel/alojamientos" className="underline underline-offset-4">
            Alojamientos
          </Link>
          .
        </p>
      </AppShell>
    );
  }

  const { units, categories } = await listBookableUnits(org.orgId, property.id);
  const requested = one(query, "fecha");
  const checkIn = requested && isISODate(requested) ? requested : todayIn(property.timezone);
  const checkOut = addDays(checkIn, 1);
  const bookableCategories = categories.filter((c) => units.some((u) => u.categoryId === c.id));

  return (
    <AppShell title="Nueva reserva" email={access.user.email} showAdminLink={access.isPlatformAdmin}>
      <div className="grid gap-4">
        <Link href={back} className="text-sm underline underline-offset-4">
          ← Volver al calendario
        </Link>
        {writable ? null : <ReadOnlyNotice />}
        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
        <p className="text-sm font-medium">{property.name}</p>

        {!units.length ? (
          <p className="text-sm text-muted-foreground">
            Este establecimiento no tiene unidades.{" "}
            <Link href={`/panel/alojamientos/${property.id}`} className="underline underline-offset-4">
              Cargá una unidad
            </Link>
            .
          </p>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Reserva</CardTitle>
                <CardDescription>
                  La provisional retiene las fechas por las horas configuradas en el establecimiento; después vence sola.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={createBookingAction} className="grid gap-4">
                  <input type="hidden" name="propertyId" value={property.id} />
                  <fieldset disabled={!writable} className="grid gap-4">
                    <div className="grid gap-1.5">
                      <Label htmlFor="target">Unidad</Label>
                      <select id="target" name="target" required className={selectClass}>
                        <optgroup label="Unidades">
                          {units.map((u) => (
                            <option key={u.id} value={`unit:${u.id}`}>
                              {u.name} (hasta {u.maxGuests})
                            </option>
                          ))}
                        </optgroup>
                        {bookableCategories.length ? (
                          <optgroup label="Por categoría (asigna la primera libre)">
                            {bookableCategories.map((c) => (
                              <option key={c.id} value={`category:${c.id}`}>
                                {c.name}
                              </option>
                            ))}
                          </optgroup>
                        ) : null}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1.5">
                        <Label htmlFor="checkIn">Ingreso</Label>
                        <Input id="checkIn" name="checkIn" type="date" required defaultValue={checkIn} />
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor="checkOut">Salida</Label>
                        <Input id="checkOut" name="checkOut" type="date" required defaultValue={checkOut} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1.5">
                        <Label htmlFor="guestsCount">Huéspedes</Label>
                        <Input id="guestsCount" name="guestsCount" type="number" min={1} max={50} required defaultValue={2} />
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor="status">Estado</Label>
                        <select id="status" name="status" defaultValue="provisional" className={selectClass}>
                          <option value="provisional">Provisional</option>
                          <option value="confirmed">Confirmada</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="guestName">Nombre del huésped</Label>
                      <Input id="guestName" name="guestName" required maxLength={120} autoComplete="off" />
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="grid gap-1.5">
                        <Label htmlFor="guestPhone">Teléfono (opcional)</Label>
                        <Input id="guestPhone" name="guestPhone" type="tel" maxLength={40} autoComplete="off" />
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor="guestEmail">Email (opcional)</Label>
                        <Input id="guestEmail" name="guestEmail" type="email" maxLength={200} autoComplete="off" />
                      </div>
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="notes">Notas (opcional)</Label>
                      <textarea id="notes" name="notes" maxLength={2000} rows={3} className={textareaClass} />
                    </div>
                    <Button type="submit">Registrar reserva</Button>
                  </fieldset>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bloqueo</CardTitle>
                <CardDescription>Cierra fechas de una unidad sin huésped (mantenimiento, uso propio).</CardDescription>
              </CardHeader>
              <CardContent>
                <form action={createBlockAction} className="grid gap-4">
                  <input type="hidden" name="propertyId" value={property.id} />
                  <fieldset disabled={!writable} className="grid gap-4">
                    <div className="grid gap-1.5">
                      <Label htmlFor="blockUnit">Unidad a bloquear</Label>
                      <select id="blockUnit" name="unitId" required className={selectClass}>
                        {units.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1.5">
                        <Label htmlFor="blockFrom">Desde</Label>
                        <Input id="blockFrom" name="checkIn" type="date" required defaultValue={checkIn} />
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor="blockTo">Hasta (exclusivo)</Label>
                        <Input id="blockTo" name="checkOut" type="date" required defaultValue={checkOut} />
                      </div>
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="blockNotes">Motivo (opcional)</Label>
                      <Input id="blockNotes" name="notes" maxLength={2000} />
                    </div>
                    <Button type="submit" variant="outline">
                      Bloquear fechas
                    </Button>
                  </fieldset>
                </form>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}

export default function NewBookingPage(props: PageProps<"/panel/reservas/nueva">) {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Cargando…</p>}>
      <NewBookingContent searchParams={props.searchParams} />
    </Suspense>
  );
}
