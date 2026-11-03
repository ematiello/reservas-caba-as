import type { Metadata } from "next";
import { Suspense } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { safeNext } from "@/modules/organizaciones/redirect";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingresar" };

async function LoginContent({ searchParams }: Pick<PageProps<"/auth/login">, "searchParams">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeNext(params.next) : undefined;
  const notice =
    params.error === "confirmacion"
      ? "El enlace de confirmación no es válido o venció. Ingresá con tu email y contraseña."
      : undefined;
  return <LoginForm next={next} notice={notice} />;
}

export default function LoginPage(props: PageProps<"/auth/login">) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Ingresar</CardTitle>
      </CardHeader>
      <CardContent>
        <Suspense>
          <LoginContent searchParams={props.searchParams} />
        </Suspense>
      </CardContent>
    </Card>
  );
}
