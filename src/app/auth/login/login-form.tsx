"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FormBanner, FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";
import { loginAction, type FormState } from "@/modules/organizaciones/actions";

const initial: FormState = {};

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormBanner error={state.error} notice={state.notice ?? notice} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormField
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        inputMode="email"
        defaultValue={state.values?.email}
        errors={state.fieldErrors?.email}
        required
      />
      <FormField
        name="password"
        label="Contraseña"
        type="password"
        autoComplete="current-password"
        errors={state.fieldErrors?.password}
        required
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Ingresando…" : "Ingresar"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        ¿No tenés cuenta?{" "}
        <Link href="/auth/registro" className="underline underline-offset-4">
          Registrá tu negocio
        </Link>
      </p>
    </form>
  );
}
