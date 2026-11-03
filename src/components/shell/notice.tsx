import type { ReactNode } from "react";

export function Notice({ tone, children }: { tone: "success" | "error" | "warning"; children: ReactNode }) {
  const styles = {
    success: "border-emerald-600/40 bg-emerald-600/10 text-emerald-900 dark:text-emerald-200",
    error: "border-destructive/40 bg-destructive/10 text-destructive",
    warning: "border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200",
  }[tone];
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-md border p-3 text-sm ${styles}`}>
      {children}
    </p>
  );
}

/** Message for an ?ok= / ?error= code, or null when there is none. */
export function messageFor(
  query: { ok?: string | string[]; error?: string | string[] },
  messages: Record<string, string>,
): { tone: "success" | "error"; text: string } | null {
  const ok = typeof query.ok === "string" ? query.ok : undefined;
  const error = typeof query.error === "string" ? query.error : undefined;
  if (error) return { tone: "error", text: messages[error] ?? "No se pudo completar la operación." };
  if (ok && messages[ok]) return { tone: "success", text: messages[ok] };
  return null;
}
