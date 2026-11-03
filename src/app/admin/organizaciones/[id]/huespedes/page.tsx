import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { AppShell } from "@/components/shell/app-shell";
import { Notice } from "@/components/shell/notice";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { logAdminAccess } from "@/modules/auditoria/queries";
import { listGuests } from "@/modules/huespedes/queries";
import { getOrganizationName } from "@/modules/organizaciones/queries";
import { requirePlatformAdmin } from "@/modules/organizaciones/session";

export const metadata: Metadata = { title: "Huéspedes de la organización" };

async function GuestsContent({ params }: Pick<PageProps<"/admin/organizaciones/[id]/huespedes">, "params">) {
  await requirePlatformAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const orgName = await getOrganizationName(id);
  if (orgName === null) notFound();
  // Every opening is audited before any data is read; if the audit row fails, nothing is shown.
  await logAdminAccess(id, "guests");
  const guests = await listGuests(id, undefined);

  return (
    <AppShell title={`Huéspedes · ${orgName}`}>
      <div className="grid gap-6">
        <Link href={`/admin/organizaciones/${id}`} className="text-sm underline underline-offset-4">
          ← Volver a la organización
        </Link>
        <Notice tone="warning">Vista de solo lectura. Esta consulta queda registrada en la actividad de la organización.</Notice>
        <Card>
          <CardHeader>
            <CardTitle>Huéspedes ({guests.length})</CardTitle>
            <CardDescription>Por nombre, hasta 50.</CardDescription>
          </CardHeader>
          <CardContent>
            {guests.length ? (
              <ul className="divide-y text-sm">
                {guests.map((g) => (
                  <li key={g.id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span className="font-medium">{g.full_name}</span>
                    <span className="text-muted-foreground">
                      {[g.phone, g.email].filter(Boolean).join(" · ") || "Sin contacto"} · {g.bookings}{" "}
                      {g.bookings === 1 ? "reserva" : "reservas"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Esta organización todavía no tiene huéspedes.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

export default function OrgGuestsPage(props: PageProps<"/admin/organizaciones/[id]/huespedes">) {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Cargando…</p>}>
      <GuestsContent params={props.params} />
    </Suspense>
  );
}
