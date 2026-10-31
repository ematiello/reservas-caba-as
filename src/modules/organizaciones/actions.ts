"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { safeNext } from "./redirect";
import { completePendingRegistration } from "./registration";
import { createOrganizationSchema, loginSchema, registerSchema } from "./schemas";
import { requireUser } from "./session";

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

async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${h.get("host")}`;
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

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/login");
}
