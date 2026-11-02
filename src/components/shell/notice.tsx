import type { ReactNode } from "react";

export function Notice({ tone, children }: { tone: "success" | "error" | "warning"; children: ReactNode }) {
  const styles = {
    success: "border-brand-olive/50 bg-brand-olive/12 text-brand-green-deep",
    error: "border-destructive/40 bg-destructive/10 text-destructive",
    warning: "border-brand-ochre/60 bg-brand-ochre/15 text-[#6b4a1c]",
  }[tone];
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-xl border p-3 text-sm ${styles}`}>
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
