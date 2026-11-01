import { z } from "zod";

import { RESERVED_SLUGS, slugify } from "@/modules/organizaciones/schemas";

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .transform((v) => v || null);

const intInRange = (min: number, max: number, message: string) =>
  z.string().trim().regex(/^\d+$/, message).transform(Number).pipe(z.number().int().min(min, message).max(max, message));

const optionalInt = (max: number, message: string) =>
  z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value === "") return null;
      if (!/^\d+$/.test(value) || Number(value) > max) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return Number(value);
    });

const optionalCoordinate = (limit: number) =>
  z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value === "") return null;
      const n = Number(value.replace(",", "."));
      if (!Number.isFinite(n) || Math.abs(n) > limit) {
        ctx.addIssue({ code: "custom", message: `Ingresá un número entre -${limit} y ${limit}.` });
        return z.NEVER;
      }
      return n;
    });

const optionalTime = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === "") return null;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
      ctx.addIssue({ code: "custom", message: "Ingresá una hora válida (HH:MM)." });
      return z.NEVER;
    }
    return value;
  });

// wa.me wants the full international number with digits only.
const whatsapp = z
  .string()
  .transform((value, ctx) => {
    const digits = value.replace(/\D/g, "");
    if (digits === "") return null;
    if (digits.length < 8 || digits.length > 15) {
      ctx.addIssue({ code: "custom", message: "Ingresá el número completo con código de país, por ejemplo +54 9 351 555-1234." });
      return z.NEVER;
    }
    return digits;
  });

const name = z.string().trim().min(2, "Ingresá un nombre.").max(120, "El nombre es demasiado largo.");

export const newPropertySchema = z
  .object({ name, slug: z.string().trim().default("") })
  .transform((value, ctx) => {
    const slug = slugify(value.slug || value.name);
    if (slug.length < 3 || !SLUG_PATTERN.test(slug)) {
      ctx.addIssue({ code: "custom", path: ["slug"], message: "La dirección debe tener al menos 3 letras o números." });
      return z.NEVER;
    }
    if ((RESERVED_SLUGS as readonly string[]).includes(slug)) {
      ctx.addIssue({ code: "custom", path: ["slug"], message: "Esa dirección está reservada. Elegí otra." });
      return z.NEVER;
    }
    return { name: value.name, slug };
  });

export const propertySchema = z
  .object({
    name,
    description: z.string().trim().max(5000, "Máximo 5000 caracteres."),
    address: optionalText(200),
    city: optionalText(100),
    province: optionalText(100),
    lat: optionalCoordinate(90),
    lng: optionalCoordinate(180),
    whatsapp,
    checkInTime: optionalTime,
    checkOutTime: optionalTime,
    cleaningBufferDays: intInRange(0, 30, "Entre 0 y 30 días."),
    provisionalHoldHours: intInRange(6, 12, "Entre 6 y 12 horas."),
    depositPct: intInRange(0, 100, "Entre 0 y 100."),
  })
  .refine((v) => (v.lat === null) === (v.lng === null), {
    path: ["lng"],
    message: "Completá latitud y longitud, o dejá las dos vacías.",
  });

// Numeric caps here and in propertySchema are technical sanity bounds that mirror the database
// CHECKs, not commercial parameters (docs/05-decisiones.md, D25).
export const UNIT_KINDS = ["cabin", "house", "apartment", "room"] as const;

export const unitSchema = z
  .object({
    name: z.string().trim().min(1, "Ingresá un nombre.").max(80, "El nombre es demasiado largo."),
    kind: z.enum(UNIT_KINDS, "Elegí un tipo."),
    maxGuests: intInRange(1, 50, "Entre 1 y 50 huéspedes."),
    bedrooms: optionalInt(50, "Hasta 50 dormitorios."),
    beds: optionalInt(100, "Hasta 100 camas."),
    categoryId: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
    description: z.string().trim().max(5000, "Máximo 5000 caracteres."),
    isPublished: z.string().optional(),
  })
  .transform(({ isPublished, ...rest }) => ({ ...rest, isPublished: isPublished === "on" }));

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Ingresá un nombre.").max(80, "El nombre es demasiado largo."),
  description: z.string().trim().max(2000, "Máximo 2000 caracteres."),
});

export const UNIT_KIND_LABEL: Record<(typeof UNIT_KINDS)[number], string> = {
  cabin: "Cabaña",
  house: "Casa",
  apartment: "Departamento",
  room: "Habitación",
};
