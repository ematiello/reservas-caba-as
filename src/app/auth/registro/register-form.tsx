"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FormBanner, FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";
import { registerAction, type FormState } from "@/modules/organizaciones/actions";

const initial: FormState = {};

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, initial);
  const v = state.values;
  const e = state.fieldErrors;

  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormBanner error={state.error} notice={state.notice} />
      <FormField name="fullName" label="Tu nombre" autoComplete="name" defaultValue={v?.fullName} errors={e?.fullName} required />
      <FormField
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        inputMode="email"
        defaultValue={v?.email}
        errors={e?.email}
        required
      />
      <FormField
        name="password"
        label="Contraseña"
        type="password"
        autoComplete="new-password"
        hint="Entre 8 y 72 caracteres."
        errors={e?.password}
        required
      />
      <FormField name="orgName" label="Nombre de tu negocio" defaultValue={v?.orgName} errors={e?.orgName} required />
      <FormField
        name="slug"
        label="Dirección pública (opcional)"
        hint="Si la dejás vacía, la generamos a partir del nombre del negocio."
        autoCapitalize="none"
        defaultValue={v?.slug}
        errors={e?.slug}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Creando cuenta…" : "Registrar mi negocio"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tenés cuenta?{" "}
        <Link href="/auth/login" className="underline underline-offset-4">
          Ingresá
        </Link>
      </p>
    </form>
  );
}
