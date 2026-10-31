import { z } from "zod";

// Mirrors the CHECK constraint on organizations.slug (public pages live at /{slug}).
export const RESERVED_SLUGS = [
  "admin",
  "panel",
  "api",
  "auth",
  "login",
  "registro",
  "logout",
  "invitacion",
  "precios",
  "static",
] as const;

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

const email = z.string().trim().toLowerCase().pipe(z.email("Ingresá un email válido."));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Ingresá tu contraseña."),
});

const orgFields = {
  orgName: z
    .string()
    .trim()
    .min(2, "Ingresá el nombre de tu negocio.")
    .max(120, "El nombre del negocio es demasiado largo."),
  slug: z.string().trim().default(""),
};

// The public address comes from the explicit slug or, if empty, from the business name.
function withResolvedSlug<T extends { slug: string; orgName: string }>(value: T, ctx: z.RefinementCtx): T {
  const slug = slugify(value.slug || value.orgName);
  if (slug.length < 3 || !SLUG_PATTERN.test(slug)) {
    ctx.addIssue({
      code: "custom",
      path: ["slug"],
      message: "La dirección pública debe tener al menos 3 letras o números.",
    });
  } else if ((RESERVED_SLUGS as readonly string[]).includes(slug)) {
    ctx.addIssue({ code: "custom", path: ["slug"], message: "Esa dirección está reservada. Elegí otra." });
  }
  return { ...value, slug };
}

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, "Ingresá tu nombre.").max(120, "El nombre es demasiado largo."),
    email,
    // 72 is bcrypt's input limit: longer passwords would be silently truncated.
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres.")
      .max(72, "La contraseña no puede superar los 72 caracteres."),
    ...orgFields,
  })
  .transform(withResolvedSlug);

// For a signed-in user who has no organization yet (e.g. the slug was taken at registration).
export const createOrganizationSchema = z.object(orgFields).transform(withResolvedSlug);

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
