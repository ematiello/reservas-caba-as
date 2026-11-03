import type { Metadata } from "next";
import { Suspense } from "react";

import { HOLIDAY_MESSAGES, HolidayEditor } from "@/components/holidays/holiday-editor";
import { AppShell } from "@/components/shell/app-shell";
import { messageFor, Notice } from "@/components/shell/notice";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/modules/organizaciones/session";
import { addHolidayAction, deleteHolidayAction } from "@/modules/tarifas/holiday-actions";
import { listHolidays } from "@/modules/tarifas/queries";

export const metadata: Metadata = { title: "Feriados" };

async function HolidaysContent({ searchParams }: Pick<PageProps<"/admin/feriados">, "searchParams">) {
  await requirePlatformAdmin();
  const [query, holidays] = await Promise.all([searchParams, listHolidays(null)]);
  const message = messageFor(query, HOLIDAY_MESSAGES);

  return (
    <AppShell title="Feriados">
      <div className="grid gap-4">
        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
        <Card>
          <CardHeader>
            <CardTitle>Feriados nacionales</CardTitle>
            <CardDescription>
              Los usan las tarifas de tipo feriado de todos los establecimientos. Cada organización puede sumar los suyos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HolidayEditor
              holidays={holidays}
              addAction={addHolidayAction}
              deleteAction={deleteHolidayAction}
              empty="Todavía no hay feriados cargados."
            />
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
