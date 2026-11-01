import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Notice } from "@/components/shell/notice";
import { AppShell } from "@/components/shell/app-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { reviewOrganizationAction } from "@/modules/organizaciones/actions";
import { listOrganizationsForAdmin, type AdminOrganization } from "@/modules/organizaciones/queries";
import { requirePlatformAdmin } from "@/modules/organizaciones/session";
import { formatArs } from "@/modules/suscripciones/billing";
import { formatDate, lastPaidDay, STATUS_LABEL } from "@/modules/suscripciones/labels";
import { listPlans, listSubscriptions, type Plan, type Subscription } from "@/modules/suscripciones/queries";

export const metadata: Metadata = { title: "Administración" };

const date = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeZone: "America/Argentina/Buenos_Aires" });

function OrgInfo({ org }: { org: AdminOrganization }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-medium">{org.name}</p>
      <p className="text-sm text-muted-foreground">
        {org.ownerName} · /{org.slug} · {date.format(new Date(org.createdAt))}
      </p>
    </div>
  );
}

function PendingRow({ org, plans }: { org: AdminOrganization; plans: Plan[] }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <OrgInfo org={org} />
      <form action={reviewOrganizationAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="orgId" value={org.id} />
        <select
          aria-label={`Plan para ${org.name}`}
          name="planId"
          defaultValue=""
          className="h-8 rounded-md border bg-background px-2 text-sm"
        >
          <option value="">Sin plan (asignar después)</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {formatArs(p.price_cents)}
            </option>
          ))}
        </select>
        <Button type="submit" name="decision" value="approve" size="sm" aria-label={`Aprobar ${org.name}`}>
          Aprobar
        </Button>
        <Button type="submit" name="decision" value="reject" size="sm" variant="outline" aria-label={`Rechazar ${org.name}`}>
          Rechazar
        </Button>
      </form>
    </li>
  );
}

function ActiveRow({ org, sub }: { org: AdminOrganization; sub: Subscription | undefined }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <OrgInfo org={org} />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {sub ? (
          <span>
            {STATUS_LABEL[sub.status]} · hasta {formatDate(lastPaidDay(sub.current_period_end))}
          </span>
        ) : (
          <span className="text-muted-foreground">Sin suscripción</span>
        )}
        <Link
          href={`/admin/organizaciones/${org.id}`}
          className={buttonVariants({ size: "sm", variant: "outline" })}
          aria-label={`Suscripción de ${org.name}`}
        >
          Suscripción
        </Link>
      </div>
    </li>
  );
}

function Section({ title, description, count, children }: { title: string; description: string; count: number; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {title} ({count})
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {count ? <ul className="divide-y">{children}</ul> : (
          <p className="text-sm text-muted-foreground">No hay organizaciones en este estado.</p>
        )}
      </CardContent>
    </Card>
  );
}

async function AdminContent({ searchParams }: Pick<PageProps<"/admin">, "searchParams">) {
  const access = await requirePlatformAdmin();
  const [orgs, plans, subs, query] = await Promise.all([
    listOrganizationsForAdmin(),
    listPlans(),
    listSubscriptions(),
    searchParams,
  ]);
  const activePlans = plans.filter((p) => p.is_active);
  const pending = orgs.filter((o) => o.status === "pending_approval");
  const active = orgs.filter((o) => o.status === "active");
  const rejected = orgs.filter((o) => o.status === "rejected");

  return (
    <AppShell title="Administración" email={access.user.email} showPanelLink>
      <div className="grid gap-6">
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/planes" className={buttonVariants({ variant: "outline" })}>
            Planes y ajustes
          </Link>
          <Link href="/admin/feriados" className={buttonVariants({ variant: "outline" })}>
            Feriados
          </Link>
        </div>
        {query.error === "revision" ? (
          <Notice tone="error">
            No se pudo registrar la decisión: la solicitud ya fue revisada, no existe o el plan está inactivo. La lista
            está actualizada.
          </Notice>
        ) : null}
        <Section title="Solicitudes de organizaciones" description="Negocios que esperan aprobación." count={pending.length}>
          {pending.map((org) => (
            <PendingRow key={org.id} org={org} plans={activePlans} />
          ))}
        </Section>
        <Section title="Activas" description="Organizaciones aprobadas y su suscripción." count={active.length}>
          {active.map((org) => (
            <ActiveRow key={org.id} org={org} sub={subs.get(org.id)} />
          ))}
        </Section>
        <Section title="Rechazadas" description="Solicitudes que no fueron aprobadas." count={rejected.length}>
          {rejected.map((org) => (
            <li key={org.id} className="py-3">
              <OrgInfo org={org} />
            </li>
          ))}
        </Section>
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
