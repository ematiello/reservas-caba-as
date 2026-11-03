import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { AppShell } from "@/components/shell/app-shell";
import { messageFor, Notice } from "@/components/shell/notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateGuestAction } from "@/modules/huespedes/actions";
import { getGuest } from "@/modules/huespedes/queries";
import { writeAccess } from "@/modules/organizaciones/access";
import { requireActiveMembership } from "@/modules/organizaciones/session";
import { formatDate } from "@/modules/reservas/calendar";
import { formatArs } from "@/modules/suscripciones/billing";

import { ReadOnlyNotice, STATUS_LABEL, textareaClass } from "../../reservas/shared";

export const metadata: Metadata = { title: "Huésped" };

const MESSAGES: Record<string, string> = {
  guardado: "Datos del huésped guardados.",
  datos_invalidos: "Revisá los datos: nombre obligatorio y email válido.",
  escritura: "No se pudo guardar. Revisá que la cuenta esté activa.",
};

async function GuestContent({ params, searchParams }: PageProps<"/panel/huespedes/[id]">) {
  const { access, org } = await requireActiveMembership();
  const [{ id }, query, { writable }] = await Promise.all([params, searchParams, writeAccess(org)]);
  if (!z.uuid().safeParse(id).success) notFound();
  const detail = await getGuest(org.orgId, id);
  if (!detail) notFound();
  const { guest, stays } = detail;
  const message = messageFor(query, MESSAGES);

  return (
    <AppShell title={guest.full_name} email={access.user.email} showAdminLink={access.isPlatformAdmin}>
      <div className="grid gap-4">
        <Link href="/panel/huespedes" className="text-sm underline underline-offset-4">
          ← Todos los huéspedes
        </Link>
        {writable ? null : <ReadOnlyNotice />}
        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

        <Card>
          <CardHeader>
            <CardTitle>Estadías</CardTitle>
          </CardHeader>
          <CardContent>
            {stays.length ? (
              <ul className="grid gap-2 text-sm">
                {stays.map((s) => (
                  <li key={s.id}>
                    <Link href={`/panel/reservas/${s.id}`} className="flex flex-wrap gap-x-2 underline-offset-4 hover:underline">
                      <span>
                        {formatDate(s.checkIn)} → {formatDate(s.checkOut)}
                      </span>
                      <span>{s.unitName}</span>
                      <span className="text-muted-foreground">{STATUS_LABEL[s.status]}</span>
                      {s.totalCents !== null ? <span>{formatArs(s.totalCents)}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Sin estadías.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Datos de contacto</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateGuestAction} className="grid gap-3">
              <input type="hidden" name="guestId" value={guest.id} />
              <fieldset disabled={!writable} className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="fullName">Nombre</Label>
                  <Input id="fullName" name="fullName" required maxLength={120} defaultValue={guest.full_name} />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input id="phone" name="phone" type="tel" maxLength={40} defaultValue={guest.phone ?? ""} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" maxLength={200} defaultValue={guest.email ?? ""} />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="notes">Notas</Label>
                  <textarea id="notes" name="notes" maxLength={2000} rows={3} className={textareaClass} defaultValue={guest.notes} />
                </div>
                <Button type="submit">Guardar</Button>
              </fieldset>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

export default function GuestPage(props: PageProps<"/panel/huespedes/[id]">) {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Cargando…</p>}>
      <GuestContent params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
