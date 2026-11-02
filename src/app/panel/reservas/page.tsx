import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { messageFor, Notice } from "@/components/shell/notice";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { writeAccess } from "@/modules/organizaciones/access";
import { requireActiveMembership } from "@/modules/organizaciones/session";
import {
  addDays,
  blocksDates,
  formatDate,
  isISODate,
  occupancyGrid,
  todayIn,
  viewRange,
  weekdayShort,
  type ViewKind,
} from "@/modules/reservas/calendar";
import { getCalendar, listPropertyOptions } from "@/modules/reservas/queries";

import { CELL_CLASS, cellClass, MESSAGES, ReadOnlyNotice, selectClass, STATUS_LABEL } from "./shared";

export const metadata: Metadata = { title: "Reservas" };

type Query = Awaited<PageProps<"/panel/reservas">["searchParams"]>;

const one = (query: Query, key: string) => (typeof query[key] === "string" ? (query[key] as string) : undefined);

async function CalendarContent({ searchParams }: Pick<PageProps<"/panel/reservas">, "searchParams">) {
  const { org } = await requireActiveMembership();
  const [query, properties, { writable }] = await Promise.all([searchParams, listPropertyOptions(org.orgId), writeAccess(org)]);
  const message = messageFor(query, MESSAGES);

  if (!properties.length) {
    return (
      <AppShell title="Reservas">
        <Card>
          <CardHeader>
            <CardTitle>Todavía no hay alojamientos</CardTitle>
            <CardDescription>Cargá un establecimiento con sus unidades para empezar a registrar reservas.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/panel/alojamientos" className={buttonVariants()}>
              Ir a Alojamientos
            </Link>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const property = properties.find((p) => p.id === one(query, "property")) ?? properties[0];
  const view: ViewKind = one(query, "vista") === "mes" ? "mes" : "semana";
  const today = todayIn(property.timezone);
  const requested = one(query, "fecha");
  const anchor = requested && isISODate(requested) ? requested : today;
  const range = viewRange(view, anchor);
  const calendar = await getCalendar(org.orgId, property.id, range.from, range.to);
  const now = new Date();
  const grid = occupancyGrid(calendar.units.map((u) => u.id), calendar.bookings, range.days, now);
  const unitName = new Map(calendar.units.map((u) => [u.id, u.name]));
  const listed = calendar.bookings
    .filter((b) => blocksDates(b, now) && b.checkIn < range.to && b.checkOut > range.from)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));

  const href = (params: Record<string, string>) =>
    `/panel/reservas?${new URLSearchParams({ property: property.id, vista: view, fecha: anchor, ...params })}`;
  const title = view === "semana" ? `Semana del ${formatDate(range.from)}` : `${formatDate(range.from).slice(3)}`;

  return (
    <AppShell title="Reservas">
      <div className="grid gap-4">
        <Link href="/panel" className="text-sm underline underline-offset-4">
          ← Volver al panel
        </Link>
        {writable ? null : <ReadOnlyNotice />}
        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

        <div className="flex flex-wrap items-end gap-3">
          {properties.length > 1 ? (
            <form className="flex items-end gap-2">
              <input type="hidden" name="vista" value={view} />
              <input type="hidden" name="fecha" value={anchor} />
              <div className="grid gap-1.5">
                <Label htmlFor="property">Establecimiento</Label>
                <select id="property" name="property" defaultValue={property.id} className={selectClass}>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" variant="outline">
                Ver
              </Button>
            </form>
          ) : (
            <p className="text-sm font-medium">{property.name}</p>
          )}
          {writable ? (
            <Link
              href={`/panel/reservas/nueva?${new URLSearchParams({ property: property.id, fecha: anchor < today ? today : anchor })}`}
              className={buttonVariants({ className: "ml-auto" })}
            >
              Nueva reserva o bloqueo
            </Link>
          ) : null}
        </div>

        <nav aria-label="Período" className="flex flex-wrap items-center gap-2">
          <Link href={href({ fecha: range.prev })} className={buttonVariants({ variant: "outline", size: "sm" })}>
            ← Anterior
          </Link>
          <Link href={href({ fecha: today })} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Hoy
          </Link>
          <Link href={href({ fecha: range.next })} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Siguiente →
          </Link>
          <span className="ml-auto flex gap-1">
            <Link
              href={href({ vista: "semana" })}
              aria-current={view === "semana" ? "page" : undefined}
              className={buttonVariants({ variant: view === "semana" ? "default" : "outline", size: "sm" })}
            >
              Semana
            </Link>
            <Link
              href={href({ vista: "mes" })}
              aria-current={view === "mes" ? "page" : undefined}
              className={buttonVariants({ variant: view === "mes" ? "default" : "outline", size: "sm" })}
            >
              Mes
            </Link>
          </span>
        </nav>

        <h2 className="text-base font-semibold">{title}</h2>

        {calendar.units.length ? (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full border-collapse text-xs">
              <caption className="sr-only">
                Ocupación de {property.name} del {formatDate(range.from)} al {formatDate(addDays(range.to, -1))}
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 z-10 min-w-28 border-b bg-background p-2 text-left">
                    Unidad
                  </th>
                  {range.days.map((day) => (
                    <th
                      key={day}
                      scope="col"
                      className={`min-w-10 border-b border-l p-1 text-center ${day === today ? "bg-accent" : ""}`}
                    >
                      <span className="block font-normal text-muted-foreground">{weekdayShort(day)}</span>
                      {day.slice(8)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {calendar.units.map((unit) => (
                  <tr key={unit.id}>
                    <th scope="row" className="sticky left-0 z-10 border-b bg-background p-2 text-left font-medium">
                      {unit.name}
                    </th>
                    {grid.get(unit.id)!.map((cell, i) => {
                      const day = range.days[i];
                      if (cell.kind === "free") return <td key={day} className="h-9 border-b border-l" />;
                      if (cell.kind === "cleaning") {
                        return (
                          <td key={day} className={`h-9 border-b border-l ${CELL_CLASS.cleaning}`} title="Limpieza">
                            <span className="sr-only">Limpieza</span>
                          </td>
                        );
                      }
                      const b = cell.booking;
                      const showLabel = cell.starts || i === 0;
                      return (
                        <td key={day} className={`h-9 border-b border-l p-0 ${cellClass(b.status, b.kind)}`}>
                          {showLabel ? (
                            <Link
                              href={`/panel/reservas/${b.id}`}
                              className="block h-9 truncate px-1 leading-9 underline-offset-2 hover:underline"
                              title={`${b.label} · ${formatDate(b.checkIn)} → ${formatDate(b.checkOut)}`}
                            >
                              {b.label}
                            </Link>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Este establecimiento todavía no tiene unidades.</p>
        )}

        <ul className="flex flex-wrap gap-3 text-xs" aria-label="Referencias">
          <li className="flex items-center gap-1">
            <span className={`size-3 rounded-sm ${CELL_CLASS.provisional}`} /> Provisional
          </li>
          <li className="flex items-center gap-1">
            <span className={`size-3 rounded-sm ${CELL_CLASS.confirmed}`} /> Confirmada
          </li>
          <li className="flex items-center gap-1">
            <span className={`size-3 rounded-sm ${CELL_CLASS.checked_in}`} /> Alojado
          </li>
          <li className="flex items-center gap-1">
            <span className={`size-3 rounded-sm ${CELL_CLASS.block}`} /> Bloqueo
          </li>
          <li className="flex items-center gap-1">
            <span className={`size-3 rounded-sm border ${CELL_CLASS.cleaning}`} /> Limpieza
          </li>
        </ul>

        <Card>
          <CardHeader>
            <CardTitle>Reservas del período</CardTitle>
          </CardHeader>
          <CardContent>
            {listed.length ? (
              <ul className="grid gap-2">
                {listed.map((b) => (
                  <li key={b.id}>
                    <Link href={`/panel/reservas/${b.id}`} className="flex flex-wrap gap-x-2 text-sm underline-offset-4 hover:underline">
                      <span className="font-medium">{b.label}</span>
                      <span>{unitName.get(b.unitId)}</span>
                      <span>
                        {formatDate(b.checkIn)} → {formatDate(b.checkOut)}
                      </span>
                      <span className="text-muted-foreground">{b.kind === "block" ? "Bloqueo" : STATUS_LABEL[b.status]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No hay reservas ni bloqueos en este período.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

export default function BookingsPage(props: PageProps<"/panel/reservas">) {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Cargando…</p>}>
      <CalendarContent searchParams={props.searchParams} />
    </Suspense>
  );
}
