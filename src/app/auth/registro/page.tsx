import type { Metadata } from "next";
import { Suspense } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeNext } from "@/modules/organizaciones/redirect";

import { CollaboratorRegisterForm } from "./collaborator-register-form";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Crear cuenta" };

async function RegisterContent({ searchParams }: Pick<PageProps<"/auth/registro">, "searchParams">) {
  const params = await searchParams;

  // Someone invited to a business only needs an account; the business already exists.
  if (params.modo === "colaborador") {
    const next = safeNext(typeof params.next === "string" ? params.next : undefined);
    return (
      <>
        <CardHeader>
          <CardTitle className="text-xl">Creá tu cuenta</CardTitle>
          <CardDescription>Con tu cuenta vas a poder aceptar la invitación de tu equipo.</CardDescription>
        </CardHeader>
        <CardContent>
          <CollaboratorRegisterForm next={next} />
        </CardContent>
      </>
    );
  }

  return (
    <>
      <CardHeader>
        <CardTitle className="text-xl">Registrá tu negocio</CardTitle>
        <CardDescription>Un administrador revisará tu solicitud antes de activar la cuenta.</CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm />
      </CardContent>
    </>
  );
}

export default function RegisterPage(props: PageProps<"/auth/registro">) {
  return (
    <Card>
      <Suspense fallback={<CardContent className="text-sm text-muted-foreground">Cargando…</CardContent>}>
        <RegisterContent searchParams={props.searchParams} />
      </Suspense>
    </Card>
  );
}
