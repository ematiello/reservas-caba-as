import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAccess } from "@/modules/organizaciones/session";
import { acceptInvitationAction } from "@/modules/organizaciones/team-actions";

export const metadata: Metadata = { title: "Invitación" };

const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;

async function InvitationContent({ params, searchParams }: Pick<PageProps<"/auth/invitacion/[token]">, "params" | "searchParams">) {
  const { token } = await params;
  if (!TOKEN.test(token)) notFound();
  const query = await searchParams;
  const access = await getAccess();
  const next = encodeURIComponent(`/auth/invitacion/${token}`);

  if (!access) {
    return (
      <CardContent className="grid gap-3">
        <p className="text-sm">Para aceptar la invitación, ingresá o creá una cuenta. Después volvé a este enlace.</p>
        <Link href={`/auth/login?next=${next}`} className={buttonVariants()}>
          Ingresar
        </Link>
        <Link href={`/auth/registro?modo=colaborador&next=${next}`} className={buttonVariants({ variant: "outline" })}>
          Crear una cuenta
        </Link>
      </CardContent>
    );
  }

  return (
    <CardContent className="grid gap-3">
      {query.error ? (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          La invitación no es válida, ya fue usada o venció. Pedí un enlace nuevo a quien te invitó.
        </p>
      ) : null}
      <p className="text-sm">Estás ingresado como {access.user.email}.</p>
      <form action={acceptInvitationAction}>
        <input type="hidden" name="token" value={token} />
        <Button type="submit">Aceptar invitación</Button>
      </form>
    </CardContent>
  );
}

export default function InvitationPage(props: PageProps<"/auth/invitacion/[token]">) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Te invitaron a un equipo</CardTitle>
        <CardDescription>Sumate como colaborador de un negocio en la plataforma.</CardDescription>
      </CardHeader>
      <Suspense fallback={<CardContent className="text-sm text-muted-foreground">Cargando…</CardContent>}>
        <InvitationContent params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </Card>
  );
}
