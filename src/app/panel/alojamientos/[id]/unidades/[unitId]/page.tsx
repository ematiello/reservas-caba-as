import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { AppShell } from "@/components/shell/app-shell";
import { messageFor, Notice } from "@/components/shell/notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteUnitAction, setUnitAmenitiesAction, updateUnitAction } from "@/modules/alojamientos/actions";
import { getUnit } from "@/modules/alojamientos/queries";
import { UNIT_KIND_LABEL, UNIT_KINDS } from "@/modules/alojamientos/schemas";
import { writeAccess } from "@/modules/organizaciones/access";
import { requireActiveMembership } from "@/modules/organizaciones/session";

import { PhotoUploader } from "../../../photo-uploader";
import { MESSAGES, PhotoGrid, ReadOnlyNotice, selectClass, textareaClass } from "../../../shared";

export const metadata: Metadata = { title: "Unidad" };

type Props = PageProps<"/panel/alojamientos/[id]/unidades/[unitId]">;

async function UnitContent({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const { org } = await requireActiveMembership();
  const { id, unitId } = await params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(unitId).success) notFound();
  const [detail, query, { writable, canEdit }] = await Promise.all([
    getUnit(org.orgId, id, unitId),
    searchParams,
    writeAccess(org),
  ]);
  if (!detail) notFound();

  const { property, unit: u, categories, amenities, selectedAmenityIds, media } = detail;
  const message = messageFor(query, MESSAGES);

  return (
    <AppShell title={u.name}>
      <div className="grid gap-6">
        <Link href={`/panel/alojamientos/${property.id}`} className="text-sm underline underline-offset-4">
          ← {property.name}
        </Link>
        {writable ? null : <ReadOnlyNotice />}
        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

        <Card>
          <CardHeader>
            <CardTitle>Datos de la unidad</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateUnitAction} className="grid gap-3">
              <fieldset disabled={!canEdit} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="propertyId" value={property.id} />
                <input type="hidden" name="unitId" value={u.id} />
                <div className="grid gap-1.5">
                  <Label htmlFor="name">Nombre</Label>
                  <Input id="name" name="name" defaultValue={u.name} required maxLength={80} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="kind">Tipo</Label>
                  <select id="kind" name="kind" defaultValue={u.kind} className={selectClass}>
                    {UNIT_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {UNIT_KIND_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="maxGuests">Huéspedes máximos</Label>
                  <Input id="maxGuests" name="maxGuests" inputMode="numeric" defaultValue={u.max_guests} required />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="categoryId">Categoría</Label>
                  <select id="categoryId" name="categoryId" defaultValue={u.category_id ?? ""} className={selectClass}>
                    <option value="">Sin categoría</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="bedrooms">Dormitorios</Label>
                  <Input id="bedrooms" name="bedrooms" inputMode="numeric" defaultValue={u.bedrooms ?? ""} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="beds">Camas</Label>
                  <Input id="beds" name="beds" inputMode="numeric" defaultValue={u.beds ?? ""} />
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="description">Descripción</Label>
                  <textarea id="description" name="description" defaultValue={u.description} maxLength={5000} className={textareaClass} />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="isPublished" defaultChecked={u.is_published} />
                  Mostrar en la página pública
                </label>
              </fieldset>
              {canEdit ? (
                <div>
                  <Button type="submit">Guardar unidad</Button>
                </div>
              ) : null}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Comodidades</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={setUnitAmenitiesAction} className="grid gap-3">
              <input type="hidden" name="propertyId" value={property.id} />
              <input type="hidden" name="unitId" value={u.id} />
              <fieldset disabled={!canEdit} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <legend className="sr-only">Comodidades de la unidad</legend>
                {amenities.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="amenityId" value={a.id} defaultChecked={selectedAmenityIds.has(a.id)} />
                    {a.name}
                  </label>
                ))}
              </fieldset>
              {canEdit ? (
                <div>
                  <Button type="submit" variant="outline">
                    Guardar comodidades
                  </Button>
                </div>
              ) : null}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fotos de la unidad</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <PhotoGrid media={media} propertyId={property.id} unitId={u.id} canEdit={canEdit} />
            {canEdit ? <PhotoUploader orgId={org.orgId} propertyId={property.id} unitId={u.id} /> : null}
          </CardContent>
        </Card>

        {canEdit ? (
          // Two steps without client JS: the delete button only appears after opening the panel.
          <details className="rounded-md border p-3">
            <summary className="cursor-pointer text-sm font-medium text-destructive">Eliminar unidad</summary>
            <form action={deleteUnitAction} className="mt-3 grid gap-2">
              <p className="text-sm text-muted-foreground">Se borran la unidad, sus comodidades y sus fotos. No se puede deshacer.</p>
              <input type="hidden" name="propertyId" value={property.id} />
              <input type="hidden" name="unitId" value={u.id} />
              <div>
                <Button type="submit" variant="destructive">
                  Sí, eliminar «{u.name}»
                </Button>
              </div>
            </form>
          </details>
        ) : null}
      </div>
    </AppShell>
  );
}

export default function UnitPage(props: Props) {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Cargando…</p>}>
      <UnitContent params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
