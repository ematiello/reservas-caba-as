import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listGuests } from "@/modules/huespedes/queries";
import { requireActiveMembership } from "@/modules/organizaciones/session";

export const metadata: Metadata = { title: "Huéspedes" };

async function GuestsContent({ searchParams }: Pick<PageProps<"/panel/huespedes">, "searchParams">) {
  const { org } = await requireActiveMembership();
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q : "";
  const guests = await listGuests(org.orgId, q);

  return (
    <AppShell title="Huéspedes">
      <div className="grid gap-4">
        <Link href="/panel" className="text-sm underline underline-offset-4">
          ← Volver al panel
        </Link>
        <form className="flex items-end gap-2" role="search">
          <div className="grid flex-1 gap-1.5">
            <Label htmlFor="q">Buscar por nombre, teléfono o email</Label>
            <Input id="q" name="q" defaultValue={q} maxLength={60} />
          </div>
          <Button type="submit" variant="outline">
            Buscar
          </Button>
        </form>
        <Card>
          <CardHeader>
            <CardTitle>{q ? `Resultados para «${q}»` : "Todos los huéspedes"}</CardTitle>
          </CardHeader>
          <CardContent>
            {guests.length ? (
              <ul className="grid gap-2 text-sm">
                {guests.map((g) => (
                  <li key={g.id}>
                    <Link href={`/panel/huespedes/${g.id}`} className="flex flex-wrap gap-x-2 underline-offset-4 hover:underline">
                      <span className="font-medium">{g.full_name}</span>
                      {g.phone ? <span>{g.phone}</span> : null}
                      {g.email ? <span>{g.email}</span> : null}
                      <span className="text-muted-foreground">
                        {g.bookings} {g.bookings === 1 ? "reserva" : "reservas"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {q ? "No hay huéspedes que coincidan." : "Los huéspedes aparecen acá cuando registrás reservas."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

export default function GuestsPage(props: PageProps<"/panel/huespedes">) {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Cargando…</p>}>
      <GuestsContent searchParams={props.searchParams} />
    </Suspense>
  );
}
