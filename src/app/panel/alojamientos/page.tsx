import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { messageFor, Notice } from "@/components/shell/notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPropertyAction } from "@/modules/alojamientos/actions";
import { listProperties } from "@/modules/alojamientos/queries";
import { writeAccess } from "@/modules/organizaciones/access";
import { requireActiveMembership } from "@/modules/organizaciones/session";

import { MESSAGES, ReadOnlyNotice } from "./shared";

export const metadata: Metadata = { title: "Alojamientos" };

async function PropertiesContent({ searchParams }: Pick<PageProps<"/panel/alojamientos">, "searchParams">) {
  const { access, org } = await requireActiveMembership();
  const [{ writable, canEdit }, properties, query] = await Promise.all([
    writeAccess(org),
    listProperties(org.orgId),
    searchParams,
  ]);
  const message = messageFor(query, MESSAGES);

  return (
    <AppShell title="Alojamientos" email={access.user.email} showAdminLink={access.isPlatformAdmin}>
      <div className="grid gap-6">
        <Link href="/panel" className="text-sm underline underline-offset-4">
          ← Volver al panel
        </Link>
        {writable ? null : <ReadOnlyNotice />}
        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

        {properties.length ? (
          <ul className="grid gap-3">
            {properties.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/panel/alojamientos/${p.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-4 hover:bg-muted"
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {p.unitCount} {p.unitCount === 1 ? "unidad" : "unidades"} · {p.is_published ? "Publicado" : "Borrador"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Todavía no cargaste ningún establecimiento.</p>
        )}

        {canEdit ? (
          <Card>
            <CardHeader>
              <CardTitle>Nuevo establecimiento</CardTitle>
              <CardDescription>Después vas a poder cargar la ubicación, las unidades y las fotos.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createPropertyAction} className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="name">Nombre del establecimiento</Label>
                  <Input id="name" name="name" required maxLength={120} placeholder="Cabañas del Lago" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="slug">Dirección web (opcional)</Label>
                  <Input id="slug" name="slug" maxLength={60} placeholder="Se arma con el nombre" />
                </div>
                <Button type="submit">Crear establecimiento</Button>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}

export default function PropertiesPage(props: PageProps<"/panel/alojamientos">) {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Cargando…</p>}>
      <PropertiesContent searchParams={props.searchParams} />
    </Suspense>
  );
}
