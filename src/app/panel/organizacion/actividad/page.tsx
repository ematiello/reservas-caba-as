import type { Metadata } from "next";
import { Suspense } from "react";

import { AuditList } from "@/components/audit/audit-list";
import { AppShell } from "@/components/shell/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cursorFrom, listAuditEntries } from "@/modules/auditoria/queries";
import { requireOwnerAccess } from "@/modules/organizaciones/session";

export const metadata: Metadata = { title: "Actividad" };

async function ActivityContent({ searchParams }: Pick<PageProps<"/panel/organizacion/actividad">, "searchParams">) {
  // Owner only (docs/01); audit_entries checks the owner role again in the database.
  const { org } = await requireOwnerAccess();
  const query = await searchParams;
  const entries = await listAuditEntries(org.orgId, cursorFrom(query.antes));

  return (
    <AppShell title="Actividad">
      <Card>
        <CardHeader>
          <CardTitle>Actividad de {org.orgName}</CardTitle>
          <CardDescription>Cada alta, cambio y baja queda registrada con su autor. Lo más reciente, primero.</CardDescription>
        </CardHeader>
        <CardContent>
          <AuditList entries={entries} nextHref={(before) => `/panel/organizacion/actividad?antes=${before}`} />
        </CardContent>
      </Card>
    </AppShell>
  );
}

export default function ActivityPage(props: PageProps<"/panel/organizacion/actividad">) {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Cargando…</p>}>
      <ActivityContent searchParams={props.searchParams} />
    </Suspense>
  );
}
