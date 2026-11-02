import type { Metadata } from "next";
import { Suspense } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getTeam } from "@/modules/organizaciones/queries";
import { requireOwnerAccess } from "@/modules/organizaciones/session";
import {
  changeMemberRoleAction,
  removeMemberAction,
  revokeInvitationAction,
} from "@/modules/organizaciones/team-actions";

import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Equipo" };

const ROLE_LABEL = { owner: "Propietario", admin: "Administrador", operator: "Operador" } as const;
const date = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeZone: "America/Argentina/Buenos_Aires" });

async function TeamContent() {
  const { org } = await requireOwnerAccess();
  const { members, invitations } = await getTeam(org.orgId);

  return (
    <AppShell title={`Equipo · ${org.orgName}`}>
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Invitar a una persona</CardTitle>
            <CardDescription>
              Generá un enlace y compartilo (por ejemplo, por WhatsApp). Quien lo abra tendrá que ingresar o crear una
              cuenta para aceptarlo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InviteForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Integrantes ({members.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {members.map((member) => (
                <li key={member.userId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{member.fullName}</p>
                    <p className="text-sm text-muted-foreground">{ROLE_LABEL[member.role]}</p>
                  </div>
                  {member.role === "owner" ? null : (
                    <div className="flex flex-wrap items-center gap-2">
                      <form action={changeMemberRoleAction} className="flex items-center gap-2">
                        <input type="hidden" name="userId" value={member.userId} />
                        <select
                          name="role"
                          defaultValue={member.role}
                          aria-label={`Rol de ${member.fullName}`}
                          className="h-8 rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          <option value="admin">Administrador</option>
                          <option value="operator">Operador</option>
                        </select>
                        <Button type="submit" size="sm" variant="outline" aria-label={`Cambiar rol de ${member.fullName}`}>
                          Cambiar
                        </Button>
                      </form>
                      <form action={removeMemberAction}>
                        <input type="hidden" name="userId" value={member.userId} />
                        <Button type="submit" size="sm" variant="destructive" aria-label={`Quitar a ${member.fullName}`}>
                          Quitar
                        </Button>
                      </form>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invitaciones abiertas ({invitations.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {invitations.length ? (
              <ul className="divide-y">
                {invitations.map((inv) => (
                  <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <p className="text-sm">
                      {ROLE_LABEL[inv.role]} · vence el {date.format(new Date(inv.expiresAt))}
                    </p>
                    <form action={revokeInvitationAction}>
                      <input type="hidden" name="invitationId" value={inv.id} />
                      <Button type="submit" size="sm" variant="outline">
                        Revocar
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No hay invitaciones abiertas.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

export default function TeamPage() {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Cargando…</p>}>
      <TeamContent />
    </Suspense>
  );
}
