import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { AppShell } from "@/components/shell/app-shell";
import { messageFor, Notice } from "@/components/shell/notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { writeAccess } from "@/modules/organizaciones/access";
import { requireActiveMembership } from "@/modules/organizaciones/session";
import { moveBookingAction, setBookingStatusAction } from "@/modules/reservas/actions";
import { formatDate, nights } from "@/modules/reservas/calendar";
import { getBooking } from "@/modules/reservas/queries";

import { MESSAGES, ReadOnlyNotice, selectClass, STATUS_LABEL } from "../shared";

export const metadata: Metadata = { title: "Reserva" };

type Action = { status: "confirmed" | "checked_in" | "checked_out" | "cancelled"; label: string; variant: "default" | "outline" };

// Same transitions the database allows (bookings_guard); the database has the last word.
function actionsFor(status: string, kind: string): Action[] {
  if (kind === "block") return status === "confirmed" ? [{ status: "cancelled", label: "Levantar bloqueo", variant: "outline" }] : [];
  switch (status) {
    case "provisional":
      return [
        { status: "confirmed", label: "Confirmar", variant: "default" },
        { status: "cancelled", label: "Cancelar", variant: "outline" },
      ];
    case "confirmed":
      return [
        { status: "checked_in", label: "Registrar check-in", variant: "default" },
        { status: "cancelled", label: "Cancelar", variant: "outline" },
      ];
    case "checked_in":
      return [{ status: "checked_out", label: "Registrar check-out", variant: "default" }];
    default:
      return [];
  }
}

function formatInstant(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("es-AR", { timeZone, dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

async function BookingContent({ params, searchParams }: PageProps<"/panel/reservas/[id]">) {
  const { access, org } = await requireActiveMembership();
  const [{ id }, query, { writable }] = await Promise.all([params, searchParams, writeAccess(org)]);
  if (!z.uuid().safeParse(id).success) notFound();
  const detail = await getBooking(org.orgId, id);
  if (!detail) notFound();

  const { booking, guest, property, unitName, units } = detail;
  const message = messageFor(query, MESSAGES);
  const isBlock = booking.kind === "block";
  const actions = writable ? actionsFor(booking.status, booking.kind) : [];
  const movable = writable && ["provisional", "confirmed", "checked_in"].includes(booking.status);
  const title = isBlock ? "Bloqueo" : (guest?.full_name ?? "Reserva");
  const back = `/panel/reservas?${new URLSearchParams({ property: property.id, fecha: booking.check_in })}`;

  return (
    <AppShell title={title} email={access.user.email} showAdminLink={access.isPlatformAdmin}>
      <div className="grid gap-4">
        <Link href={back} className="text-sm underline underline-offset-4">
          ← Volver al calendario
        </Link>
        {writable ? null : <ReadOnlyNotice />}
        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

        <Card>
          <CardHeader>
            <CardTitle>{isBlock ? "Bloqueo de fechas" : `Reserva de ${title}`}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Estado</dt>
              <dd data-testid="booking-status">{isBlock && booking.status === "confirmed" ? "Activo" : STATUS_LABEL[booking.status]}</dd>
              <dt className="text-muted-foreground">Establecimiento</dt>
              <dd>{property.name}</dd>
              <dt className="text-muted-foreground">Unidad</dt>
              <dd>{unitName}</dd>
              <dt className="text-muted-foreground">Fechas</dt>
              <dd>
                {formatDate(booking.check_in)} → {formatDate(booking.check_out)} ({nights(booking.check_in, booking.check_out)}{" "}
                {nights(booking.check_in, booking.check_out) === 1 ? "noche" : "noches"})
              </dd>
              {booking.cleaning_buffer_days > 0 ? (
                <>
                  <dt className="text-muted-foreground">Limpieza</dt>
                  <dd>
                    {booking.cleaning_buffer_days} {booking.cleaning_buffer_days === 1 ? "día" : "días"} después de la salida
                  </dd>
                </>
              ) : null}
              {!isBlock ? (
                <>
                  <dt className="text-muted-foreground">Huéspedes</dt>
                  <dd>{booking.guests_count}</dd>
                </>
              ) : null}
              {booking.status === "provisional" && booking.expires_at ? (
                <>
                  <dt className="text-muted-foreground">Vence</dt>
                  <dd>{formatInstant(booking.expires_at, property.timezone)}</dd>
                </>
              ) : null}
              {guest?.phone ? (
                <>
                  <dt className="text-muted-foreground">Teléfono</dt>
                  <dd>{guest.phone}</dd>
                </>
              ) : null}
              {guest?.email ? (
                <>
                  <dt className="text-muted-foreground">Email</dt>
                  <dd>{guest.email}</dd>
                </>
              ) : null}
              {booking.notes ? (
                <>
                  <dt className="text-muted-foreground">{isBlock ? "Motivo" : "Notas"}</dt>
                  <dd className="whitespace-pre-wrap">{booking.notes}</dd>
                </>
              ) : null}
            </dl>

            {actions.length ? (
              <div className="flex flex-wrap gap-2">
                {actions.map((a) => (
                  <form key={a.status} action={setBookingStatusAction}>
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <input type="hidden" name="status" value={a.status} />
                    <Button type="submit" variant={a.variant}>
                      {a.label}
                    </Button>
                  </form>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {movable ? (
          <Card>
            <CardHeader>
              <CardTitle>{isBlock ? "Cambiar fechas o unidad" : "Cambiar fechas, unidad o huéspedes"}</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={moveBookingAction} className="grid gap-4">
                <input type="hidden" name="bookingId" value={booking.id} />
                <div className="grid gap-1.5">
                  <Label htmlFor="unitId">Unidad</Label>
                  <select id="unitId" name="unitId" defaultValue={booking.unit_id} className={selectClass}>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {isBlock ? u.name : `${u.name} (hasta ${u.maxGuests})`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="moveIn">Ingreso</Label>
                    <Input id="moveIn" name="checkIn" type="date" required defaultValue={booking.check_in} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="moveOut">Salida</Label>
                    <Input id="moveOut" name="checkOut" type="date" required defaultValue={booking.check_out} />
                  </div>
                </div>
                {!isBlock ? (
                  <div className="grid gap-1.5">
                    <Label htmlFor="moveGuests">Huéspedes</Label>
                    <Input
                      id="moveGuests"
                      name="guestsCount"
                      type="number"
                      min={1}
                      max={50}
                      required
                      defaultValue={booking.guests_count ?? 1}
                    />
                  </div>
                ) : null}
                <Button type="submit" variant="outline">
                  Guardar cambios
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}

export default function BookingPage(props: PageProps<"/panel/reservas/[id]">) {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Cargando…</p>}>
      <BookingContent params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
