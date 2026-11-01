"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import { siteOrigin } from "./origin";
import { safeNext } from "./redirect";
import { completePendingRegistration } from "./registration";
import { createOrganizationSchema, loginSchema, registerCollaboratorSchema, registerSchema } from "./schemas";
import { requirePlatformAdmin, requireUser } from "./session";

export type FormState = {
  error?: string;
  notice?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  // Echoed back so a failed submit does not wipe the form (never the password).
  values?: Record<string, string>;
};

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = {
    fullName: text(formData, "fullName"),
    email: text(formData, "email"),
    password: text(formData, "password"),
    orgName: text(formData, "orgName"),
    slug: text(formData, "slug"),
  };
  const values = { fullName: raw.fullName, email: raw.email, orgName: raw.orgName, slug: raw.slug };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors, values };
  }
  const { fullName, email, password, orgName, slug } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, org_name: orgName, org_slug: slug },
      emailRedirectTo: `${await siteOrigin()}/auth/confirm`,
    },
  });
  if (error) {
    return { error: "No pudimos crear la cuenta. Revisá los datos e intentá de nuevo.", values };
  }

  if (data.session) {
    // Email confirmation is off: the session exists, so the organization is created now.
    await completePendingRegistration(supabase);
    redirect("/panel");
  }

  // Same message whether the email is new or already registered (no account enumeration).
  return {
    notice: "Te enviamos un email para confirmar tu cuenta. Al confirmarlo, un administrador revisará tu solicitud.",
  };
}

// Account for someone invited to an existing business: no organization is created. `next` brings
// them back to the invitation link after confirming their email.
export async function registerCollaboratorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = {
    fullName: text(formData, "fullName"),
    email: text(formData, "email"),
    password: text(formData, "password"),
  };
  const values = { fullName: raw.fullName, email: raw.email };
  const next = safeNext(text(formData, "next"));

  const parsed = registerCollaboratorSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };
  const { fullName, email, password } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    return { error: "No pudimos crear la cuenta. Revisá los datos e intentá de nuevo.", values };
  }
  if (data.session) redirect(next);

  return { notice: "Te enviamos un email para confirmar tu cuenta. Al confirmarlo, volvé a abrir el enlace de invitación." };
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = { email: text(formData, "email"), password: text(formData, "password") };
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors, values: { email: raw.email } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const unconfirmed = error.code === "email_not_confirmed";
    return {
      error: unconfirmed
        ? "Confirmá tu email antes de ingresar. Revisá tu bandeja de entrada."
        : "Email o contraseña incorrectos.",
      values: { email: raw.email },
    };
  }

  await completePendingRegistration(supabase);
  redirect(safeNext(text(formData, "next")));
}

export async function createOrganizationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const access = await requireUser("/panel");
  // Only users without an organization can start a new registration from here.
  if (access.memberships.length > 0) redirect("/panel");

  const raw = { orgName: text(formData, "orgName"), slug: text(formData, "slug") };
  const parsed = createOrganizationSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors, values: raw };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("register_organization", {
    p_name: parsed.data.orgName,
    p_slug: parsed.data.slug,
  });
  if (error) {
    return error.code === "23505"
      ? { fieldErrors: { slug: ["Esa dirección ya está en uso. Elegí otra."] }, values: raw }
      : { error: "No pudimos registrar el negocio. Intentá de nuevo.", values: raw };
  }
  redirect("/panel");
}

const reviewSchema = z.object({
  orgId: z.uuid(),
  decision: z.enum(["approve", "reject"]),
  // Optional: the plan can also be assigned later from the organization page.
  planId: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
});

// Superadmin only: the check here and `review_organization()` (SECURITY DEFINER, checks
// `is_platform_admin()`) are independent, so a forged request fails in both places.
export async function reviewOrganizationAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const parsed = reviewSchema.safeParse({
    orgId: text(formData, "orgId"),
    decision: text(formData, "decision"),
    planId: text(formData, "planId"),
  });
  if (!parsed.success) return;

  const approve = parsed.data.decision === "approve";
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_organization", {
    p_org: parsed.data.orgId,
    p_approve: approve,
    ...(approve && parsed.data.planId ? { p_plan: parsed.data.planId } : {}),
  });
  // e.g. already reviewed by someone else: tell the admin instead of failing silently.
  if (error) redirect("/admin?error=revision");
  revalidatePath("/admin");
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/login");
}
