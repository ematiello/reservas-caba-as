import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Notice } from "@/components/shell/notice";
import type { OrgMembership } from "@/modules/organizaciones/panel-state";
import { writeAccess } from "@/modules/organizaciones/access";
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
        <ActivePanel membership={state.membership} />
      ) : null}
    </AppShell>
  );
}

// Organization approved. Writes also need a live subscription (invariant 6): otherwise read-only.
async function ActivePanel({ membership }: { membership: OrgMembership }) {
  const { writable } = await writeAccess(membership);
  const isOwner = membership.role === "owner";
  return (
    <div className="grid gap-4">
      {writable ? null : (
        <Notice tone="warning">
          La cuenta de «{membership.orgName}» está suspendida o vencida: el panel queda en solo lectura y los datos se
          conservan.{isOwner ? " Revisá el estado en Suscripción." : " Avisale al propietario."}
        </Notice>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{membership.orgName}</CardTitle>
          <CardDescription>
            {writable ? "Tu cuenta está activa." : "Podés consultar el calendario y los alojamientos."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link href="/panel/reservas" className={buttonVariants()}>
            Reservas
          </Link>
          <Link href="/panel/alojamientos" className={buttonVariants({ variant: "outline" })}>
            Alojamientos
          </Link>
          {isOwner ? (
            <>
              <Link href="/panel/equipo" className={buttonVariants({ variant: "outline" })}>
                Gestionar equipo
              </Link>
              <Link href="/panel/suscripcion" className={buttonVariants({ variant: "outline" })}>
                Suscripción
              </Link>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export default function PanelPage() {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Cargando…</p>}>
      <PanelContent />
    </Suspense>
  );
}
