import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { logoutAction } from "@/modules/organizaciones/actions";

export const metadata: Metadata = { title: "Panel" };

// Placeholder for T3 (signed-in landing). T4 adds the server-side access check and real content.
export default function PanelPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold">Panel</h1>
      <form action={logoutAction}>
        <Button type="submit" variant="outline">
          Salir
        </Button>
      </form>
    </main>
  );
}
