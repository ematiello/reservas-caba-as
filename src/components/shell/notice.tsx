import type { ReactNode } from "react";

export function Notice({ tone, children }: { tone: "success" | "error" | "warning"; children: ReactNode }) {
  const styles = {
    success: "border-brand-olive/50 bg-brand-olive/12 text-brand-green-deep",
    error: "border-destructive/40 bg-destructive/10 text-destructive",
    warning: "border-brand-ochre/60 bg-brand-ochre/15 text-brand-ochre-ink",
  }[tone];
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-xl border p-3 text-sm ${styles}`}>
      {children}
    </p>
  );
}

/**
 * The message for a key taken from the URL, only when the map has it as its own property: a plain
 * lookup with "__proto__" or "constructor" would hand React an object or a function.
 */
export function ownMessage(messages: Record<string, string>, key: unknown): string | undefined {
  return typeof key === "string" && Object.hasOwn(messages, key) ? messages[key] : undefined;
}

/** Message for an ?ok= / ?error= code, or null when there is none. */
export function messageFor(
  query: { ok?: string | string[]; error?: string | string[] },
  messages: Record<string, string>,
): { tone: "success" | "error"; text: string } | null {
  if (typeof query.error === "string" && query.error) {
    return { tone: "error", text: ownMessage(messages, query.error) ?? "No se pudo completar la operación." };
  }
  const ok = ownMessage(messages, query.ok);
  return ok ? { tone: "success", text: ok } : null;
}
