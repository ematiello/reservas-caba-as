"use client";

import { useActionState, useState } from "react";

import { FormBanner } from "@/components/auth/form-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createInvitationAction, type InviteState } from "@/modules/organizaciones/team-actions";

const initial: InviteState = {};

const ROLE_LABEL: Record<string, string> = { admin: "Administrador", operator: "Operador" };

export function InviteForm() {
  const [state, action, pending] = useActionState(createInvitationAction, initial);
  const [copied, setCopied] = useState(false);

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the link stays selectable in the field.
    }
  }

  const whatsappHref = state.link
    ? `https://wa.me/?text=${encodeURIComponent(`Te invito a sumarte a mi equipo. Aceptá la invitación desde este enlace: ${state.link}`)}`
    : null;

  return (
    <div className="grid gap-4">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="role">Rol</Label>
          <select
            id="role"
            name="role"
            defaultValue="operator"
            className="h-9 rounded-lg border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="operator">Operador (calendario y reservas)</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creando…" : "Crear enlace de invitación"}
        </Button>
      </form>

      <FormBanner error={state.error} />

      {state.link ? (
        <div className="grid gap-2 rounded-md border bg-muted p-3" role="status">
          <p className="text-sm">
            Enlace para <strong>{ROLE_LABEL[state.role ?? ""] ?? state.role}</strong>. Vence en 7 días y sirve una sola
            vez. Copialo ahora: no lo vas a poder ver de nuevo.
          </p>
          <input
            readOnly
            value={state.link}
            aria-label="Enlace de invitación"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            onFocus={(e) => e.currentTarget.select()}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => copy(state.link!)}>
              {copied ? "Copiado" : "Copiar enlace"}
            </Button>
            {whatsappHref ? (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Compartir por WhatsApp
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
