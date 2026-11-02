import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";

import { AuditList } from "@/components/audit/audit-list";
import { AppShell } from "@/components/shell/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cursorFrom, listAuditEntries } from "@/modules/auditoria/queries";
import { requirePlatformAdmin } from "@/modules/organizaciones/session";
import { getOrgBilling } from "@/modules/suscripciones/queries";

export const metadata: Metadata = { title: "Actividad" };

async function ActivityContent({ searchParams }: Pick<PageProps<"/admin/actividad">, "searchParams">) {
  await requirePlatformAdmin();
  const query = await searchParams;
  const parsedOrg = z.uuid().safeParse(query.org);
  const orgId = parsedOrg.success ? parsedOrg.data : null;
  const [entries, billing] = await Promise.all([
    listAuditEntries(orgId, cursorFrom(query.antes)),
    orgId ? getOrgBilling(orgId) : Promise.resolve(null),
  ]);
  const base = orgId ? `/admin/actividad?org=${orgId}&` : "/admin/actividad?";

  return (
    <AppShell title="Actividad">
      <Card>
        <CardHeader>
          <CardTitle>{billing ? `Actividad de ${billing.org.name}` : "Actividad de la plataforma"}</CardTitle>
          <CardDescription>
            Cada alta, cambio, baja y consulta del administrador queda registrada con su autor. Lo más reciente, primero.
            {orgId ? (
              <>
                {" "}
                <Link href="/admin/actividad" className="underline underline-offset-4">
                  Ver todas las organizaciones
                </Link>
              </>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuditList entries={entries} showOrg={!orgId} nextHref={(before) => `${base}antes=${before}`} />
        </CardContent>
      </Card>
    </AppShell>
  );
}

export default function AdminActivityPage(props: PageProps<"/admin/actividad">) {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Cargando…</p>}>
      <ActivityContent searchParams={props.searchParams} />
    </Suspense>
  );
}
