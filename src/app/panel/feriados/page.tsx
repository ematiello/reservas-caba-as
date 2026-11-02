import type { Metadata } from "next";
import { Suspense } from "react";

import { HOLIDAY_MESSAGES, HolidayEditor } from "@/components/holidays/holiday-editor";
import { AppShell } from "@/components/shell/app-shell";
import { messageFor, Notice } from "@/components/shell/notice";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { writeAccess } from "@/modules/organizaciones/access";
import { requireManagerAccess } from "@/modules/organizaciones/session";
import { addOrgHolidayAction, deleteOrgHolidayAction } from "@/modules/tarifas/holiday-actions";
import { listHolidays } from "@/modules/tarifas/queries";

import { ReadOnlyNotice } from "../alojamientos/shared";

export const metadata: Metadata = { title: "Feriados" };

async function HolidaysContent({ searchParams }: Pick<PageProps<"/panel/feriados">, "searchParams">) {
  const { org } = await requireManagerAccess();
  const [query, own, national, { canEdit, writable }] = await Promise.all([
    searchParams,
    listHolidays(org.orgId),
    listHolidays(null),
    writeAccess(org),
  ]);
  const message = messageFor(query, HOLIDAY_MESSAGES);

  return (
    <AppShell title="Feriados">
      <div className="grid gap-4">
        {writable ? null : <ReadOnlyNotice />}
        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
        <Card>
          <CardHeader>
            <CardTitle>Feriados de {org.orgName}</CardTitle>
            <CardDescription>
              Fechas especiales de tu zona, por ejemplo la fiesta patronal. Se suman a los feriados nacionales y las
              usan las tarifas de tipo feriado de tus establecimientos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HolidayEditor
              holidays={own}
              addAction={canEdit ? addOrgHolidayAction : undefined}
              deleteAction={canEdit ? deleteOrgHolidayAction : undefined}
              empty="Todavía no cargaste feriados propios."
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Feriados nacionales</CardTitle>
            <CardDescription>Los carga la plataforma y valen para todos los establecimientos.</CardDescription>
          </CardHeader>
          <CardContent>
            <HolidayEditor holidays={national} empty="La plataforma todavía no cargó feriados nacionales." />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

export default function HolidaysPage(props: PageProps<"/panel/feriados">) {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Cargando…</p>}>
      <HolidaysContent searchParams={props.searchParams} />
    </Suspense>
  );
}
