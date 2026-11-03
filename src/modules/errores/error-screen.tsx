"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

import { reportBrowserErrorAction } from "./report-action";

// Shown by the app's error boundaries. It reports the failure once and offers a retry; the text never
// shows the technical message, only the reference (digest) the platform admin can look up.
export function ErrorScreen({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void reportBrowserErrorAction({
      message: error.message || "Unknown error",
      digest: error.digest ?? null,
      route: window.location.pathname,
    }).catch(() => {});
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-heading text-2xl font-semibold">Algo salió mal</h1>
      <p className="text-muted-foreground">
        Tuvimos un problema al mostrar esta página. Ya quedó registrado. Probá de nuevo; si sigue pasando, avisanos.
      </p>
      {error.digest ? <p className="text-sm text-muted-foreground">Referencia: {error.digest}</p> : null}
      <Button type="button" onClick={reset}>
        Reintentar
      </Button>
    </main>
  );
}
