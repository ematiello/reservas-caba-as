import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { messageFor, Notice } from "@/components/shell/notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requirePlatformAdmin } from "@/modules/organizaciones/session";
import { saveSettingsAction, savePlanAction } from "@/modules/suscripciones/actions";
import { formatArs } from "@/modules/suscripciones/billing";
import { getSettings, listPlans, type Plan } from "@/modules/suscripciones/queries";

export const metadata: Metadata = { title: "Planes y ajustes" };

const MESSAGES: Record<string, string> = {
  plan: "Plan guardado.",
  ajustes: "Ajustes guardados.",
  plan_invalido: "Revisá los datos del plan: nombre, precio (por ejemplo 15.000) y límites mayores que cero o vacíos.",
  plan_duplicado: "Ya existe un plan con ese nombre.",
  plan_error: "No se pudo guardar el plan.",
  ajustes_invalidos: "La prueba va de 1 a 90 días y la gracia de 0 a 60.",
  ajustes_error: "No se pudieron guardar los ajustes.",
};

function pesos(cents: number) {
  return (cents / 100).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function PlanForm({ plan }: { plan?: Plan }) {
  const id = plan?.id ?? "new";
  return (
    <form action={savePlanAction} className="grid gap-3 sm:grid-cols-2">
      {plan ? <input type="hidden" name="planId" value={plan.id} /> : null}
      <div className="grid gap-1.5">
        <Label htmlFor={`name-${id}`}>Nombre</Label>
        <Input id={`name-${id}`} name="name" defaultValue={plan?.name} required maxLength={60} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`price-${id}`}>Precio mensual (ARS)</Label>
        <Input
          id={`price-${id}`}
          name="price"
          inputMode="decimal"
          placeholder="15.000"
          defaultValue={plan ? pesos(plan.price_cents) : ""}
          required
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`units-${id}`}>Máximo de unidades</Label>
        <Input id={`units-${id}`} name="maxUnits" inputMode="numeric" placeholder="Sin límite" defaultValue={plan?.max_units ?? ""} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`members-${id}`}>Máximo de integrantes (incluye al propietario)</Label>
        <Input
          id={`members-${id}`}
          name="maxMembers"
          inputMode="numeric"
          placeholder="Sin límite"
          defaultValue={plan?.max_members ?? ""}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={plan ? plan.is_active : true} />
        Disponible para nuevas organizaciones
      </label>
      <div className="sm:col-span-2">
        <Button type="submit">{plan ? "Guardar cambios" : "Crear plan"}</Button>
      </div>
    </form>
  );
}

async function PlansContent({ searchParams }: Pick<PageProps<"/admin/planes">, "searchParams">) {
  await requirePlatformAdmin();
  const [plans, settings, query] = await Promise.all([listPlans(), getSettings(), searchParams]);
  const message = messageFor(query, MESSAGES);

  return (
    <AppShell title="Planes y ajustes">
      <div className="grid gap-6">
        <Link href="/admin" className="text-sm underline underline-offset-4">
          ← Volver a administración
        </Link>
        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

        <Card>
          <CardHeader>
            <CardTitle>Prueba y días de gracia</CardTitle>
            <CardDescription>
              Se aplican a las organizaciones que se aprueben desde ahora. Cada organización puede tener sus propios días
              de gracia en su ficha.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={saveSettingsAction} className="grid gap-3 sm:grid-cols-3 sm:items-end">
              <div className="grid gap-1.5">
                <Label htmlFor="trialDays">Días de prueba</Label>
                <Input id="trialDays" name="trialDays" inputMode="numeric" defaultValue={settings.trial_days} required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="graceDays">Días de gracia</Label>
                <Input id="graceDays" name="graceDays" inputMode="numeric" defaultValue={settings.default_grace_days} required />
              </div>
              <Button type="submit">Guardar ajustes</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nuevo plan</CardTitle>
            <CardDescription>Dejá vacíos los límites que no quieras restringir.</CardDescription>
          </CardHeader>
          <CardContent>
            <PlanForm />
          </CardContent>
        </Card>

        {plans.map((plan) => (
          <Card key={plan.id}>
            <CardHeader>
              <CardTitle>
                {plan.name} · {formatArs(plan.price_cents)}
                {plan.is_active ? null : <span className="ml-2 text-sm font-normal text-muted-foreground">(inactivo)</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PlanForm plan={plan} />
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}

export default function PlansPage(props: PageProps<"/admin/planes">) {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Cargando…</p>}>
      <PlansContent searchParams={props.searchParams} />
    </Suspense>
  );
}
