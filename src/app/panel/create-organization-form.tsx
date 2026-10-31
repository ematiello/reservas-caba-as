"use client";

import { useActionState } from "react";

import { FormBanner, FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";
import { createOrganizationAction, type FormState } from "@/modules/organizaciones/actions";

const initial: FormState = {};

export function CreateOrganizationForm() {
  const [state, action, pending] = useActionState(createOrganizationAction, initial);

  return (
    <form action={action} className="grid max-w-md gap-4" noValidate>
      <FormBanner error={state.error} />
      <FormField
        name="orgName"
        label="Nombre de tu negocio"
        defaultValue={state.values?.orgName}
        errors={state.fieldErrors?.orgName}
        required
      />
      <FormField
        name="slug"
        label="Dirección pública (opcional)"
        hint="Si la dejás vacía, la generamos a partir del nombre del negocio."
        autoCapitalize="none"
        defaultValue={state.values?.slug}
        errors={state.fieldErrors?.slug}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Registrando…" : "Registrar mi negocio"}
      </Button>
    </form>
  );
}
