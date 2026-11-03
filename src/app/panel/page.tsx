import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePanelAccess } from "@/modules/organizaciones/session";

import { CreateOrganizationForm } from "./create-organization-form";

export const metadata: Metadata = { title: "Panel" };

async function PanelContent() {
  // Authorize here, next to the data: layouts do not re-run on client navigation.
  const { access, state } = await requirePanelAccess();

  return (
    <AppShell title="Panel" email={access.user.email} showAdminLink={access.isPlatformAdmin}>
      {state.kind === "no_org" ? (
        <Card>
          <CardHeader>
            <CardTitle>Registrá tu negocio</CardTitle>
            <CardDescription>Todavía no tenés un negocio asociado a tu cuenta.</CardDescription>
          </CardHeader>
          <CardContent>
            <CreateOrganizationForm />
          </CardContent>
        </Card>
      ) : null}

      {state.kind === "pending" ? (
        <Card>
          <CardHeader>
            <CardTitle>Tu solicitud está en revisión</CardTitle>
            <CardDescription>
              Estamos revisando «{state.membership.orgName}». Cuando la aprobemos vas a poder usar el panel.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {state.kind === "rejected" ? (
        <Card>
          <CardHeader>
            <CardTitle>Tu solicitud no fue aprobada</CardTitle>
            <CardDescription>
              La solicitud de «{state.membership.orgName}» fue rechazada. Si creés que es un error, contactá al
              administrador de la plataforma.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {state.kind === "active" ? (
        <Card>
          <CardHeader>
            <CardTitle>{state.membership.orgName}</CardTitle>
            <CardDescription>Tu cuenta está activa. Próximamente: establecimientos y reservas.</CardDescription>
          </CardHeader>
          {state.membership.role === "owner" ? (
            <CardContent>
              <Link href="/panel/equipo" className={buttonVariants({ variant: "outline" })}>
                Gestionar equipo
              </Link>
            </CardContent>
          ) : null}
        </Card>
      ) : null}
    </AppShell>
  );
}

export default function PanelPage() {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Cargando…</p>}>
      <PanelContent />
    </Suspense>
  );
}
