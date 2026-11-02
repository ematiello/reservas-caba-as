import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { messageFor, Notice } from "@/components/shell/notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { writeAccess } from "@/modules/organizaciones/access";
import { updateOrganizationAction } from "@/modules/organizaciones/manage-actions";
import { requireOwnerAccess } from "@/modules/organizaciones/session";

import { ReadOnlyNotice } from "../alojamientos/shared";

export const metadata: Metadata = { title: "Organización" };

const MESSAGES: Record<string, string> = {
  guardado: "Datos guardados.",
  nombre_invalido: "Ingresá un nombre de 2 a 120 caracteres.",
  escritura: "No se pudo guardar. Si la cuenta está suspendida, el panel es de solo lectura.",
};

async function OrganizationContent({ searchParams }: Pick<PageProps<"/panel/organizacion">, "searchParams">) {
  const { org } = await requireOwnerAccess();
  const [query, { writable }] = await Promise.all([searchParams, writeAccess(org)]);
  const message = messageFor(query, MESSAGES);

  return (
    <AppShell title="Organización">
      <div className="grid gap-4">
        {writable ? null : <ReadOnlyNotice />}
        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
        <Card>
          <CardHeader>
            <CardTitle>Datos de la organización</CardTitle>
            <CardDescription>
              Tu dirección en la plataforma es /{org.slug}. Para cambiarla, pedíselo al administrador de la plataforma,
              porque cambia los enlaces que ya compartiste.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateOrganizationAction} className="flex flex-wrap items-end gap-3">
              <fieldset disabled={!writable} className="grid min-w-60 flex-1 gap-1.5">
                <Label htmlFor="orgName">Nombre del negocio</Label>
                <Input id="orgName" name="orgName" defaultValue={org.orgName} required minLength={2} maxLength={120} />
              </fieldset>
              {writable ? <Button type="submit">Guardar</Button> : null}
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Actividad</CardTitle>
            <CardDescription>Quién cambió qué y cuándo: reservas, tarifas, equipo, suscripción y más.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/panel/organizacion/actividad" className="text-sm font-semibold underline underline-offset-4">
              Ver la actividad de la organización
            </Link>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

export default function OrganizationPage(props: PageProps<"/panel/organizacion">) {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Cargando…</p>}>
      <OrganizationContent searchParams={props.searchParams} />
    </Suspense>
  );
}
