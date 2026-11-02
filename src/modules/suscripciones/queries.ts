import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type Tables = Database["public"]["Tables"];
export type Plan = Tables["plans"]["Row"];
export type PlatformSettings = Tables["platform_settings"]["Row"];
export type Subscription = Tables["subscriptions"]["Row"];
export type SubscriptionPayment = Tables["subscription_payments"]["Row"];

// Every read goes through the user's session: RLS decides what comes back. Callers are still
// gated by requirePlatformAdmin() / requireOwnerAccess() in the page or action.

export async function listPlans(): Promise<Plan[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("plans").select("*").order("price_cents");
  if (error) throw new Error("Could not load plans");
  return data;
}

export async function getSettings(): Promise<PlatformSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("platform_settings").select("*").single();
  if (error) throw new Error("Could not load platform settings");
  return data;
}

/** Subscriptions by organization id, for the admin list. */
export async function listSubscriptions(): Promise<Map<string, Subscription>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("subscriptions").select("*");
  if (error) throw new Error("Could not load subscriptions");
  return new Map(data.map((s) => [s.org_id, s]));
}

export type OrgBilling = {
  org: { id: string; name: string; slug: string; status: Database["public"]["Enums"]["org_status"]; disabled_at: string | null };
  subscription: Subscription | null;
  plan: Plan | null;
  payments: SubscriptionPayment[];
};

export async function getOrgBilling(orgId: string): Promise<OrgBilling | null> {
  const supabase = await createClient();
  const [orgRes, subRes, paymentsRes] = await Promise.all([
    supabase.from("organizations").select("id, name, slug, status, disabled_at").eq("id", orgId).maybeSingle(),
    supabase.from("subscriptions").select("*").eq("org_id", orgId).maybeSingle(),
    supabase.from("subscription_payments").select("*").eq("org_id", orgId).order("paid_at", { ascending: false }),
  ]);
  if (orgRes.error || subRes.error || paymentsRes.error) throw new Error("Could not load billing");
  if (!orgRes.data) return null;

  const planId = subRes.data?.plan_id;
  const planRes = planId ? await supabase.from("plans").select("*").eq("id", planId).maybeSingle() : null;
  if (planRes?.error) throw new Error("Could not load the plan");

  return { org: orgRes.data, subscription: subRes.data, plan: planRes?.data ?? null, payments: paymentsRes.data };
}

/** Whether the organization accepts writes (false when suspended or lapsed). */
export async function isOrgAccessActive(orgId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("org_access_active", { p_org: orgId });
  if (error) throw new Error("Could not check the organization status");
  return data === true;
}
