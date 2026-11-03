"use client";

import { ErrorScreen } from "@/modules/errores/error-screen";

export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen {...props} />;
}
