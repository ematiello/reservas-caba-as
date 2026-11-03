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
  "buscar",
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

const fullName = z.string().trim().min(2, "Ingresá tu nombre.").max(120, "El nombre es demasiado largo.");

// 72 is bcrypt's input limit: longer passwords would be silently truncated.
const newPassword = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres.")
  .max(72, "La contraseña no puede superar los 72 caracteres.");

// A collaborator joins an existing business through an invitation link, so no business is created.
export const registerCollaboratorSchema = z.object({ fullName, email, password: newPassword });

// Collaborator roles an owner can grant. `owner` is never invitable (also enforced in the database).
export const invitationRoleSchema = z.enum(["admin", "operator"]);

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
    fullName,
    email,
    password: newPassword,
    ...orgFields,
  })
  .transform(withResolvedSlug);

// For a signed-in user who has no organization yet (e.g. the slug was taken at registration).
export const createOrganizationSchema = z.object(orgFields).transform(withResolvedSlug);

// The business name and slug travel in the user's signup metadata, which the user controls:
// run them through the same rules as the form before they reach the database.
export function orgFromMetadata(meta: unknown): { orgName: string; slug: string } | null {
  if (typeof meta !== "object" || meta === null) return null;
  const { org_name, org_slug } = meta as Record<string, unknown>;
  const parsed = createOrganizationSchema.safeParse({
    orgName: typeof org_name === "string" ? org_name : "",
    slug: typeof org_slug === "string" ? org_slug : "",
  });
  return parsed.success ? parsed.data : null;
}

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
