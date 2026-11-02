import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { AppShell } from "@/components/shell/app-shell";
import { messageFor, Notice } from "@/components/shell/notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createCategoryAction,
  createUnitAction,
  deleteCategoryAction,
  deletePropertyAction,
  setPropertyPublishedAction,
  updateCategoryAction,
  updatePropertyAction,
} from "@/modules/alojamientos/actions";
import { getProperty } from "@/modules/alojamientos/queries";
import { UNIT_KIND_LABEL, UNIT_KINDS } from "@/modules/alojamientos/schemas";
import { writeAccess } from "@/modules/organizaciones/access";
import { requireActiveMembership } from "@/modules/organizaciones/session";

import { PhotoUploader } from "../photo-uploader";
import { MESSAGES, PhotoGrid, ReadOnlyNotice, selectClass, textareaClass } from "../shared";

export const metadata: Metadata = { title: "Establecimiento" };

function hhmm(time: string | null) {
  return time ? time.slice(0, 5) : "";
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

async function PropertyContent({ params, searchParams }: Pick<PageProps<"/panel/alojamientos/[id]">, "params" | "searchParams">) {
  const { org } = await requireActiveMembership();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [detail, query, { writable, canEdit }] = await Promise.all([
    getProperty(org.orgId, id),
    searchParams,
    writeAccess(org),
  ]);
  if (!detail) notFound();

  const { property: p, categories, units, media } = detail;
  const message = messageFor(query, MESSAGES);
  const publishedUnits = units.filter((u) => u.is_published).length;

  return (
    <AppShell title={p.name}>
      <div className="grid gap-6">
        <Link href="/panel/alojamientos" className="text-sm underline underline-offset-4">
          ← Todos los alojamientos
        </Link>
        <Link href={`/panel/alojamientos/${p.id}/tarifas`} className="text-sm font-medium underline underline-offset-4">
          Tarifas y descuentos →
        </Link>
        {writable ? null : <ReadOnlyNotice />}
        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

        <Card>
          <CardHeader>
            <CardTitle>{p.is_published ? "Publicado" : "Borrador"}</CardTitle>
            <CardDescription>
              Dirección web: /{p.slug} · {units.length} unidades ({publishedUnits} publicadas) · {media.length} fotos
            </CardDescription>
          </CardHeader>
          {canEdit ? (
            <CardContent>
              <form action={setPropertyPublishedAction}>
                <input type="hidden" name="propertyId" value={p.id} />
                <input type="hidden" name="publish" value={p.is_published ? "false" : "true"} />
                <Button type="submit" variant={p.is_published ? "outline" : "default"}>
                  {p.is_published ? "Despublicar" : "Publicar establecimiento"}
                </Button>
              </form>
            </CardContent>
          ) : null}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Unidades</CardTitle>
            <CardDescription>Cada cabaña, casa, departamento o habitación es una unidad.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {units.length ? (
              <ul className="divide-y">
                {units.map((u) => (
                  <li key={u.id}>
                    <Link
                      href={`/panel/alojamientos/${p.id}/unidades/${u.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 py-3 hover:underline"
                    >
                      <span className="font-medium">{u.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {UNIT_KIND_LABEL[u.kind]} · hasta {u.max_guests} huéspedes · {u.is_published ? "Publicada" : "Oculta"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Todavía no hay unidades.</p>
            )}
            {canEdit ? (
              <form action={createUnitAction} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                <p className="font-medium sm:col-span-2">Nueva unidad</p>
                <input type="hidden" name="propertyId" value={p.id} />
                <input type="hidden" name="description" value="" />
                <input type="hidden" name="bedrooms" value="" />
                <input type="hidden" name="beds" value="" />
                <Field id="unit-name" label="Nombre de la unidad">
                  <Input id="unit-name" name="name" required maxLength={80} placeholder="Cabaña 1" />
                </Field>
                <Field id="unit-kind" label="Tipo">
                  <select id="unit-kind" name="kind" defaultValue="cabin" className={selectClass}>
                    {UNIT_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {UNIT_KIND_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field id="unit-guests" label="Huéspedes máximos">
                  <Input id="unit-guests" name="maxGuests" inputMode="numeric" required defaultValue="2" />
                </Field>
                <Field id="unit-category" label="Categoría (opcional)">
                  <select id="unit-category" name="categoryId" defaultValue="" className={selectClass}>
                    <option value="">Sin categoría</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="isPublished" defaultChecked />
                  Mostrar en la página pública
                </label>
                <div className="sm:col-span-2">
                  <Button type="submit">Agregar unidad</Button>
                </div>
              </form>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fotos del establecimiento</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <PhotoGrid media={media} propertyId={p.id} canEdit={canEdit} />
            {canEdit ? <PhotoUploader orgId={org.orgId} propertyId={p.id} /> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Datos y ubicación</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updatePropertyAction} className="grid gap-3">
              <fieldset disabled={!canEdit} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="propertyId" value={p.id} />
                <Field id="name" label="Nombre">
                  <Input id="name" name="name" defaultValue={p.name} required maxLength={120} />
                </Field>
                <Field id="whatsapp" label="WhatsApp (con código de país)">
                  <Input id="whatsapp" name="whatsapp" inputMode="tel" defaultValue={p.whatsapp ? `+${p.whatsapp}` : ""} placeholder="+54 9 351 555-1234" />
                </Field>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="description">Descripción</Label>
                  <textarea id="description" name="description" defaultValue={p.description} maxLength={5000} className={textareaClass} />
                </div>
                <Field id="address" label="Dirección">
                  <Input id="address" name="address" defaultValue={p.address ?? ""} maxLength={200} />
                </Field>
                <Field id="city" label="Localidad">
                  <Input id="city" name="city" defaultValue={p.city ?? ""} maxLength={100} />
                </Field>
                <Field id="province" label="Provincia">
                  <Input id="province" name="province" defaultValue={p.province ?? ""} maxLength={100} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field id="lat" label="Latitud">
                    <Input id="lat" name="lat" inputMode="decimal" defaultValue={p.lat ?? ""} placeholder="-31.42" />
                  </Field>
                  <Field id="lng" label="Longitud">
                    <Input id="lng" name="lng" inputMode="decimal" defaultValue={p.lng ?? ""} placeholder="-64.49" />
                  </Field>
                </div>
                <Field id="checkInTime" label="Hora de ingreso">
                  <Input id="checkInTime" name="checkInTime" type="time" defaultValue={hhmm(p.check_in_time)} />
                </Field>
                <Field id="checkOutTime" label="Hora de salida">
                  <Input id="checkOutTime" name="checkOutTime" type="time" defaultValue={hhmm(p.check_out_time)} />
                </Field>
                {/* Booking settings are configuration: operators do not see them (CLAUDE.md, fixed roles). */}
                {org.role === "operator" ? null : (
                  <>
                    <Field id="cleaningBufferDays" label="Días de limpieza entre estadías">
                      <Input id="cleaningBufferDays" name="cleaningBufferDays" inputMode="numeric" defaultValue={p.cleaning_buffer_days} required />
                    </Field>
                    <Field id="provisionalHoldHours" label="Horas de reserva provisional (6 a 12)">
                      <Input id="provisionalHoldHours" name="provisionalHoldHours" inputMode="numeric" defaultValue={p.provisional_hold_hours} required />
                    </Field>
                    <Field id="depositPct" label="Seña sugerida (%)">
                      <Input id="depositPct" name="depositPct" inputMode="numeric" defaultValue={p.deposit_pct} required />
                    </Field>
                  </>
                )}
              </fieldset>
              {canEdit ? (
                <div>
                  <Button type="submit">Guardar datos</Button>
                </div>
              ) : null}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Categorías</CardTitle>
            <CardDescription>Opcional: agrupan unidades iguales, por ejemplo habitaciones dobles.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {categories.length ? (
              <ul className="divide-y">
                {categories.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-end justify-between gap-2 py-2">
                    {canEdit ? (
                      <>
                        <form action={updateCategoryAction} className="flex flex-1 flex-wrap items-end gap-2">
                          <input type="hidden" name="propertyId" value={p.id} />
                          <input type="hidden" name="categoryId" value={c.id} />
                          <input type="hidden" name="description" value={c.description} />
                          <Input
                            name="name"
                            defaultValue={c.name}
                            required
                            minLength={2}
                            maxLength={80}
                            aria-label={`Nombre de la categoría ${c.name}`}
                            className="max-w-xs"
                          />
                          <Button type="submit" size="sm" variant="outline">
                            Guardar
                          </Button>
                        </form>
                        <form action={deleteCategoryAction}>
                          <input type="hidden" name="propertyId" value={p.id} />
                          <input type="hidden" name="categoryId" value={c.id} />
                          <Button type="submit" size="sm" variant="outline" aria-label={`Eliminar categoría ${c.name}`}>
                            Eliminar
                          </Button>
                        </form>
                      </>
                    ) : (
                      <span>{c.name}</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Sin categorías.</p>
            )}
            {canEdit ? (
              <form action={createCategoryAction} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="propertyId" value={p.id} />
                <input type="hidden" name="description" value="" />
                <Field id="category-name" label="Nueva categoría">
                  <Input id="category-name" name="name" required maxLength={80} />
                </Field>
                <Button type="submit" variant="outline">
                  Agregar
                </Button>
              </form>
            ) : null}
          </CardContent>
        </Card>

        {canEdit ? (
          <Card>
            <CardHeader>
              <CardTitle>Eliminar establecimiento</CardTitle>
              <CardDescription>
                Borra el establecimiento con sus unidades, tarifas y fotos. Solo se puede si no tiene reservas ni
                bloqueos; si los tiene, despublicalo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={deletePropertyAction} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="propertyId" value={p.id} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="confirm" required />
                  Entiendo que no se puede deshacer
                </label>
                <Button type="submit" variant="destructive">
                  Eliminar establecimiento
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}

export default function PropertyPage(props: PageProps<"/panel/alojamientos/[id]">) {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Cargando…</p>}>
      <PropertyContent params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
