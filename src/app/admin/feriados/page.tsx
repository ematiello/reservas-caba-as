import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { messageFor, Notice } from "@/components/shell/notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requirePlatformAdmin } from "@/modules/organizaciones/session";
import { formatDate } from "@/modules/reservas/calendar";
import { addHolidayAction, deleteHolidayAction } from "@/modules/tarifas/holiday-actions";
import { listHolidays } from "@/modules/tarifas/queries";

export const metadata: Metadata = { title: "Feriados" };

const MESSAGES: Record<string, string> = {
  feriado: "Feriado agregado.",
  feriado_borrado: "Feriado borrado.",
  feriado_invalido: "Revisá la fecha y el nombre.",
  feriado_repetido: "Ya hay un feriado en esa fecha.",
  feriado_error: "No se pudo guardar el feriado.",
};

async function HolidaysContent({ searchParams }: Pick<PageProps<"/admin/feriados">, "searchParams">) {
  const access = await requirePlatformAdmin();
  const [query, holidays] = await Promise.all([searchParams, listHolidays()]);
  const message = messageFor(query, MESSAGES);

  return (
    <AppShell title="Feriados" email={access.user.email} showPanelLink>
      <div className="grid gap-4">
        <Link href="/admin" className="text-sm underline underline-offset-4">
          ← Administración
        </Link>
        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
        <Card>
          <CardHeader>
            <CardTitle>Feriados nacionales</CardTitle>
            <CardDescription>Los usan las tarifas de tipo feriado de todos los establecimientos.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <form action={addHolidayAction} className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="holidayDate">Fecha</Label>
                <Input id="holidayDate" name="date" type="date" required />
              </div>
              <div className="grid flex-1 gap-1.5">
                <Label htmlFor="holidayName">Nombre</Label>
                <Input id="holidayName" name="name" required maxLength={80} />
              </div>
              <Button type="submit">Agregar</Button>
            </form>
            {holidays.length ? (
              <ul className="grid gap-2 text-sm">
                {holidays.map((h) => (
                  <li key={h.date} className="flex items-center justify-between gap-2">
                    <span>
                      {formatDate(h.date)} · {h.name}
                    </span>
                    <form action={deleteHolidayAction}>
                      <input type="hidden" name="date" value={h.date} />
                      <Button type="submit" variant="outline" size="sm">
                        Borrar
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Todavía no hay feriados cargados.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

export default function HolidaysPage(props: PageProps<"/admin/feriados">) {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Cargando…</p>}>
      <HolidaysContent searchParams={props.searchParams} />
    </Suspense>
  );
}
