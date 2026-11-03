import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { STATUS_LABEL } from "@/app/panel/reservas/shared";
import { AppShell } from "@/components/shell/app-shell";
import { Notice } from "@/components/shell/notice";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { logAdminAccess } from "@/modules/auditoria/queries";
import { getOrganizationName } from "@/modules/organizaciones/queries";
import { requirePlatformAdmin } from "@/modules/organizaciones/session";
import { formatDate, nights } from "@/modules/reservas/calendar";
import { listOrgBookings } from "@/modules/reservas/queries";
import { formatArs } from "@/modules/suscripciones/billing";

export const metadata: Metadata = { title: "Reservas de la organización" };

const LIMIT = 100;

async function BookingsContent({ params }: Pick<PageProps<"/admin/organizaciones/[id]/reservas">, "params">) {
  await requirePlatformAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const orgName = await getOrganizationName(id);
  if (orgName === null) notFound();
  // Every opening is audited before any data is read; if the audit row fails, nothing is shown.
  await logAdminAccess(id, "bookings");
  const bookings = await listOrgBookings(id, LIMIT);

  return (
    <AppShell title={`Reservas · ${orgName}`}>
      <div className="grid gap-6">
        <Link href={`/admin/organizaciones/${id}`} className="text-sm underline underline-offset-4">
          ← Volver a la organización
        </Link>
        <Notice tone="warning">Vista de solo lectura. Esta consulta queda registrada en la actividad de la organización.</Notice>
        <Card>
          <CardHeader>
            <CardTitle>Reservas y bloqueos ({bookings.length})</CardTitle>
            <CardDescription>
              Las últimas {LIMIT} por fecha de llegada, de la más lejana en el futuro a la más antigua.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {bookings.length ? (
              <ul className="divide-y text-sm">
                {bookings.map((b) => (
                  <li key={b.id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span className="min-w-0">
                      <span className="font-medium">
                        {b.kind === "block" ? "Bloqueo" : (b.guestName ?? "Sin huésped")}
                      </span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {b.propertyName} · {b.unitName}
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      {formatDate(b.checkIn)} → {formatDate(b.checkOut)} ({nights(b.checkIn, b.checkOut)} noches) ·{" "}
                      {STATUS_LABEL[b.status]}
                      {b.totalCents !== null && b.currency === "ARS" ? ` · ${formatArs(b.totalCents)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Esta organización todavía no tiene reservas.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

export default function OrgBookingsPage(props: PageProps<"/admin/organizaciones/[id]/reservas">) {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Cargando…</p>}>
      <BookingsContent params={props.params} />
    </Suspense>
  );
}
