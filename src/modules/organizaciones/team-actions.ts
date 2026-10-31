"use server";

import { createHash, randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import { siteOrigin } from "./origin";
import { invitationRoleSchema } from "./schemas";
import { requireOwnerAccess, requireUser } from "./session";

export type InviteState = { error?: string; link?: string; role?: string };

const idSchema = z.uuid();
const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

// Every action below re-checks that the caller owns the active organization (the organization
// comes from their own memberships), and RLS enforces the same rule again in the database.

export async function createInvitationAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const { access, org } = await requireOwnerAccess();
  const role = invitationRoleSchema.safeParse(text(formData, "role"));
  if (!role.success) return { error: "Elegí un rol válido." };

  // The raw token only exists here and in the link shown once; the database keeps its sha256.
  const token = randomBytes(24).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const supabase = await createClient();
  const { error } = await supabase
    .from("invitations")
    .insert({ org_id: org.orgId, role: role.data, token_hash: tokenHash, created_by: access.user.id });
  if (error) return { error: "No pudimos crear la invitación. Intentá de nuevo." };

  revalidatePath("/panel/equipo");
  return { link: `${await siteOrigin()}/auth/invitacion/${token}`, role: role.data };
}

export async function revokeInvitationAction(formData: FormData): Promise<void> {
  await requireOwnerAccess();
  const id = idSchema.safeParse(text(formData, "invitationId"));
  if (!id.success) return;

  const supabase = await createClient();
  await supabase.from("invitations").update({ revoked_at: new Date().toISOString() }).eq("id", id.data);
  revalidatePath("/panel/equipo");
}

export async function changeMemberRoleAction(formData: FormData): Promise<void> {
  const { org } = await requireOwnerAccess();
  const userId = idSchema.safeParse(text(formData, "userId"));
  const role = invitationRoleSchema.safeParse(text(formData, "role"));
  if (!userId.success || !role.success) return;

  const supabase = await createClient();
  await supabase.from("memberships").update({ role: role.data }).eq("org_id", org.orgId).eq("user_id", userId.data);
  revalidatePath("/panel/equipo");
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const { org } = await requireOwnerAccess();
  const userId = idSchema.safeParse(text(formData, "userId"));
  if (!userId.success) return;

  const supabase = await createClient();
  await supabase.from("memberships").delete().eq("org_id", org.orgId).eq("user_id", userId.data);
  revalidatePath("/panel/equipo");
}

// Accepting is a POST from a signed-in user (never a GET), so a link preview cannot consume it.
export async function acceptInvitationAction(formData: FormData): Promise<void> {
  const token = text(formData, "token");
  if (!TOKEN.test(token)) redirect("/panel");
  await requireUser(`/auth/invitacion/${token}`);

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) redirect(`/auth/invitacion/${token}?error=1`);
  redirect("/panel");
}
