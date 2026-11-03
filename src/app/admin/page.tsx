import type { Metadata } from "next";
import { Suspense } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/modules/organizaciones/session";

export const metadata: Metadata = { title: "Administración" };

async function AdminContent() {
  const access = await requirePlatformAdmin();

  return (
    <AppShell title="Administración" email={access.user.email} showPanelLink>
      <Card>
        <CardHeader>
          <CardTitle>Solicitudes de organizaciones</CardTitle>
        </CardHeader>
      </Card>
    </AppShell>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Cargando…</p>}>
      <AdminContent />
    </Suspense>
  );
}
