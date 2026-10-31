import type { Metadata } from "next";
import { Suspense } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { reviewOrganizationAction } from "@/modules/organizaciones/actions";
import type { OrgStatus } from "@/modules/organizaciones/panel-state";
import { listOrganizationsForAdmin, type AdminOrganization } from "@/modules/organizaciones/queries";
import { requirePlatformAdmin } from "@/modules/organizaciones/session";

export const metadata: Metadata = { title: "Administración" };

const date = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeZone: "America/Argentina/Buenos_Aires" });

function OrganizationRow({ org, actions }: { org: AdminOrganization; actions?: boolean }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{org.name}</p>
        <p className="text-sm text-muted-foreground">
          {org.ownerName} · /{org.slug} · {date.format(new Date(org.createdAt))}
        </p>
      </div>
      {actions ? (
        <form action={reviewOrganizationAction} className="flex gap-2">
          <input type="hidden" name="orgId" value={org.id} />
          <Button type="submit" name="decision" value="approve" size="sm" aria-label={`Aprobar ${org.name}`}>
            Aprobar
          </Button>
          <Button type="submit" name="decision" value="reject" size="sm" variant="outline" aria-label={`Rechazar ${org.name}`}>
            Rechazar
          </Button>
        </form>
      ) : null}
    </li>
  );
}

function Section({
  title,
  description,
  status,
  orgs,
  actions,
}: {
  title: string;
  description: string;
  status: OrgStatus;
  orgs: AdminOrganization[];
  actions?: boolean;
}) {
  const rows = orgs.filter((o) => o.status === status);
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {title} ({rows.length})
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length ? (
          <ul className="divide-y">
            {rows.map((org) => (
              <OrganizationRow key={org.id} org={org} actions={actions} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No hay organizaciones en este estado.</p>
        )}
      </CardContent>
    </Card>
  );
}

async function AdminContent({ searchParams }: Pick<PageProps<"/admin">, "searchParams">) {
  const access = await requirePlatformAdmin();
  const [orgs, query] = await Promise.all([listOrganizationsForAdmin(), searchParams]);

  return (
    <AppShell title="Administración" email={access.user.email} showPanelLink>
      <div className="grid gap-6">
        {query.error === "revision" ? (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            No se pudo registrar la decisión: la solicitud ya fue revisada o no existe. La lista está actualizada.
          </p>
        ) : null}
        <Section
          title="Solicitudes de organizaciones"
          description="Negocios que esperan aprobación."
          status="pending_approval"
          orgs={orgs}
          actions
        />
        <Section title="Activas" description="Organizaciones aprobadas." status="active" orgs={orgs} />
        <Section title="Rechazadas" description="Solicitudes que no fueron aprobadas." status="rejected" orgs={orgs} />
      </div>
    </AppShell>
  );
}

export default function AdminPage(props: PageProps<"/admin">) {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Cargando…</p>}>
      <AdminContent searchParams={props.searchParams} />
    </Suspense>
  );
}
