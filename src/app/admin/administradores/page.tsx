import type { Metadata } from "next";
import { Suspense } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { messageFor, Notice } from "@/components/shell/notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listPlatformAdmins } from "@/modules/auditoria/queries";
import { grantPlatformAdminAction, revokePlatformAdminAction } from "@/modules/organizaciones/admin-actions";
import { requirePlatformAdmin } from "@/modules/organizaciones/session";

export const metadata: Metadata = { title: "Administradores" };

const MESSAGES: Record<string, string> = {
  alta: "Administrador agregado. Ya puede entrar a la administración con su cuenta.",
  quitado: "Administrador quitado.",
  email_invalido: "Ingresá un email válido.",
  sin_cuenta: "No hay ninguna cuenta con ese email. La persona primero tiene que registrarse.",
  alta_error: "No se pudo agregar al administrador.",
  quitar_propio: "No podés quitarte a vos mismo. Pedíselo a otro administrador.",
  quitar_error: "No se pudo quitar al administrador.",
};

const date = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeZone: "America/Argentina/Buenos_Aires" });

async function AdminsContent({ searchParams }: Pick<PageProps<"/admin/administradores">, "searchParams">) {
  const access = await requirePlatformAdmin();
  const [admins, query] = await Promise.all([listPlatformAdmins(), searchParams]);
  const message = messageFor(query, MESSAGES);

  return (
    <AppShell title="Administradores">
      <div className="grid gap-6">
        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
        <Card>
          <CardHeader>
            <CardTitle>Agregar administrador</CardTitle>
            <CardDescription>
              Por el email de una cuenta ya registrada. Tiene acceso completo a todas las organizaciones.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={grantPlatformAdminAction} className="flex flex-wrap items-end gap-3">
              <div className="grid min-w-64 flex-1 gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" autoComplete="off" required />
              </div>
              <Button type="submit">Agregar</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Administradores ({admins.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {admins.map((a) => (
                <li key={a.user_id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="font-medium">{a.full_name || a.email}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {a.email} · desde {date.format(new Date(a.created_at))}
                    </span>
                  </span>
                  {a.user_id === access.user.id ? (
                    <span className="text-muted-foreground">Vos</span>
                  ) : (
                    <form action={revokePlatformAdminAction}>
                      <input type="hidden" name="userId" value={a.user_id} />
                      <Button type="submit" size="sm" variant="outline" aria-label={`Quitar a ${a.email}`}>
                        Quitar
                      </Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

export default function AdminsPage(props: PageProps<"/admin/administradores">) {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Cargando…</p>}>
      <AdminsContent searchParams={props.searchParams} />
    </Suspense>
  );
}
