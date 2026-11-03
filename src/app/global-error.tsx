"use client";

import { ErrorScreen } from "@/modules/errores/error-screen";

// Last resort when the root layout itself fails: it replaces the layout, so it brings its own shell.
export default function GlobalError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body>
        <ErrorScreen {...props} />
      </body>
    </html>
  );
}
