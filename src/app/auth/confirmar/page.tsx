import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { confirmEmailAction } from "@/modules/organizaciones/actions";
import { parseEmailConfirmation } from "@/modules/organizaciones/email-confirmation";
import { safeNext } from "@/modules/organizaciones/redirect";

export const metadata: Metadata = { title: "Confirmar cuenta", robots: { index: false, follow: false } };

async function ConfirmContent({ searchParams }: Pick<PageProps<"/auth/confirmar">, "searchParams">) {
  const query = await searchParams;
  const one = (key: string) => (typeof query[key] === "string" ? query[key] : null);
  const confirmation = parseEmailConfirmation(one("token_hash"), one("type"));
  if (!confirmation) redirect("/auth/login?error=confirmacion");

  return (
    <CardContent>
      <form action={confirmEmailAction}>
        <input type="hidden" name="token_hash" value={confirmation.tokenHash} />
        <input type="hidden" name="type" value={confirmation.type} />
        <input type="hidden" name="next" value={safeNext(one("next"))} />
        <Button type="submit" className="w-full">
          Confirmar mi cuenta
        </Button>
      </form>
    </CardContent>
  );
}

// The token is verified only when the user presses the button (a POST), never when a mail
// scanner or a link preview opens the email link.
export default function ConfirmPage(props: PageProps<"/auth/confirmar">) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Confirmá tu cuenta</CardTitle>
        <CardDescription>Tocá el botón para terminar de confirmar tu email.</CardDescription>
      </CardHeader>
      <Suspense fallback={<CardContent className="text-sm text-muted-foreground">Cargando…</CardContent>}>
        <ConfirmContent searchParams={props.searchParams} />
      </Suspense>
    </Card>
  );
}
