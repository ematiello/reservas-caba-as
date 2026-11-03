import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { logoutAction } from "@/modules/organizaciones/actions";

type AppShellProps = {
  title: string;
  email: string;
  showAdminLink?: boolean;
  showPanelLink?: boolean;
  children: ReactNode;
};

export function AppShell({ title, email, showAdminLink, showPanelLink, children }: AppShellProps) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <h1 className="text-lg font-semibold">{title}</h1>
          <nav className="flex flex-wrap items-center gap-3 text-sm">
            {showPanelLink ? (
              <Link href="/panel" className="underline underline-offset-4">
                Mi panel
              </Link>
            ) : null}
            {showAdminLink ? (
              <Link href="/admin" className="underline underline-offset-4">
                Administración
              </Link>
            ) : null}
            <span className="text-muted-foreground">{email}</span>
            <form action={logoutAction}>
              <Button type="submit" variant="outline" size="sm">
                Salir
              </Button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
