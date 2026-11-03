import { randomBytes } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { adminClient, anonClient, assertDbEnv, createTestUser, newToken, uniqueSlug, type TestUser } from "./helpers";

// Phase 2: plans, subscriptions, manual payments, lifecycle and invariant 6 (docs/03).
// Dates are simulated by moving each test subscription's period relative to today, never by
// running the lifecycle with a future date: the job touches every subscription in the project.
assertDbEnv();
const skipDb = process.env.SKIP_DB_TESTS === "1";

function todayAr(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function addMonths(date: string, months: number): string {
  // Same rule as Postgres date + interval 'n months': clamp to the last day of the target month.
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.toISOString().slice(0, 10);
}

describe.skipIf(skipDb)("subscriptions (Phase 2)", () => {
  let admin: SupabaseClient;
  const users: TestUser[] = [];
  const orgIds: string[] = [];
  const planIds: string[] = [];

  let superadmin: TestUser;
  let ownerA: TestUser;
  let operatorA: TestUser;
  let ownerB: TestUser;
  let orgA: string;
  let orgB: string;
  let planId: string;
  const today = todayAr();

  async function newUser(label: string) {
    const user = await createTestUser(admin, label);
    users.push(user);
    return user;
  }

  async function newOrg(owner: TestUser, label: string, plan: string | null = null) {
    const { data, error } = await owner.client.rpc("register_organization", {
      p_name: `Org ${label}`,
      p_slug: uniqueSlug(label),
    });
    expect(error).toBeNull();
    const org = data as string;
    orgIds.push(org);
    const approved = await superadmin.client.rpc("review_organization", {
      p_org: org,
      p_approve: true,
      ...(plan ? { p_plan: plan } : {}),
    });
    expect(approved.error).toBeNull();
    return org;
  }

  async function subscriptionOf(org: string) {
    const { data, error } = await admin.from("subscriptions").select("*").eq("org_id", org).single();
    expect(error).toBeNull();
    return data;
  }

  async function setSubscription(org: string, values: Record<string, unknown>) {
    const { error } = await admin.from("subscriptions").update(values).eq("org_id", org);
    expect(error).toBeNull();
  }

  async function runLifecycle() {
    const { error } = await admin.rpc("run_subscription_lifecycle", { p_today: today });
    expect(error).toBeNull();
  }

  async function invite(owner: TestUser, org: string) {
    const { token, hash } = newToken();
    const { error } = await owner.client
      .from("invitations")
      .insert({ org_id: org, role: "operator", token_hash: hash, created_by: owner.id });
    return { token, error };
  }

  async function newPlan(values: Record<string, unknown> = {}) {
    const { data, error } = await superadmin.client
      .from("plans")
      .insert({ name: `Plan ${randomBytes(4).toString("hex")}`, price_cents: 1_000_000, ...values })
      .select("id")
      .single();
    expect(error).toBeNull();
    planIds.push(data!.id);
    return data!.id as string;
  }

  beforeAll(async () => {
    admin = adminClient();
    [superadmin, ownerA, operatorA, ownerB] = await Promise.all([
      newUser("subsuper"),
      newUser("subownera"),
      newUser("subopera"),
      newUser("subownerb"),
    ]);
    await admin.from("platform_admins").insert({ user_id: superadmin.id });
    planId = await newPlan();
    orgA = await newOrg(ownerA, "suba", planId);
    orgB = await newOrg(ownerB, "subb");
    const { token } = await invite(ownerA, orgA);
    const accepted = await operatorA.client.rpc("accept_invitation", { p_token: token });
    expect(accepted.error).toBeNull();
  });

  afterAll(async () => {
    if (orgIds.length) {
      await admin.from("audit_log").delete().in("org_id", orgIds);
      await admin.from("organizations").delete().in("id", orgIds);
    }
    if (planIds.length) {
      await admin.from("audit_log").delete().eq("table_name", "plans").in("record_id", planIds);
      await admin.from("plans").delete().in("id", planIds);
    }
    for (const user of users) await admin.auth.admin.deleteUser(user.id);
  });

  describe("approval and trial", () => {
    it("starts a trial with the chosen plan, the configured trial days and grace days", async () => {
      const { data: settings } = await admin.from("platform_settings").select("*").single();
      const sub = await subscriptionOf(orgA);
      expect(sub.status).toBe("trial");
      expect(sub.plan_id).toBe(planId);
      expect(sub.current_period_start).toBe(today);
      expect(sub.current_period_end).toBe(addDays(today, settings!.trial_days));
      expect(sub.trial_ends_at).toBe(sub.current_period_end);
      expect(sub.grace_days).toBe(settings!.default_grace_days);
    });

    it("approves without a plan, which can be assigned later", async () => {
      const sub = await subscriptionOf(orgB);
      expect(sub.status).toBe("trial");
      expect(sub.plan_id).toBeNull();
    });

    it("refuses to approve with an inactive plan and leaves the organization pending", async () => {
      const inactive = await newPlan({ is_active: false });
      const owner = await newUser("subinactive");
      const { data: org } = await owner.client.rpc("register_organization", {
        p_name: "Org inactive",
        p_slug: uniqueSlug("inactive"),
      });
      orgIds.push(org as string);
      const { error } = await superadmin.client.rpc("review_organization", {
        p_org: org,
        p_approve: true,
        p_plan: inactive,
      });
      expect(error?.message).toMatch(/plan not found or inactive/);
      const { data } = await admin.from("organizations").select("status").eq("id", org).single();
      expect(data!.status).toBe("pending_approval");
      const { count } = await admin
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("org_id", org);
      expect(count).toBe(0);
    });
  });

  describe("plans and settings", () => {
    it("anonymous visitors see active plans only", async () => {
      const inactive = await newPlan({ is_active: false });
      const { data, error } = await anonClient().from("plans").select("id").in("id", [planId, inactive]);
      expect(error).toBeNull();
      expect(data!.map((p) => p.id)).toEqual([planId]);
    });

    it("only the platform admin creates or edits plans", async () => {
      const insert = await ownerA.client.from("plans").insert({ name: `Plan x ${randomBytes(3).toString("hex")}`, price_cents: 1 });
      expect(insert.error).not.toBeNull();

      const ownerUpdate = await ownerA.client.from("plans").update({ price_cents: 1 }).eq("id", planId).select();
      expect(ownerUpdate.data ?? []).toHaveLength(0);

      const update = await superadmin.client.from("plans").update({ price_cents: 2_000_000 }).eq("id", planId).select();
      expect(update.error).toBeNull();
      expect(update.data![0].price_cents).toBe(2_000_000);
    });

    it("only the platform admin edits trial and grace days", async () => {
      const { data: before } = await admin.from("platform_settings").select("*").single();
      const owner = await ownerA.client
        .from("platform_settings")
        .update({ default_grace_days: 30 })
        .eq("id", true)
        .select();
      expect(owner.data ?? []).toHaveLength(0);

      // Writes back the current values so the shared dev settings are not changed.
      const update = await superadmin.client
        .from("platform_settings")
        .update({ trial_days: before!.trial_days, default_grace_days: before!.default_grace_days })
        .eq("id", true)
        .select();
      expect(update.error).toBeNull();
      expect(update.data).toHaveLength(1);
    });
  });

  describe("read access", () => {
    it("the owner reads the subscription; operators and other organizations do not", async () => {
      const own = await ownerA.client.from("subscriptions").select("org_id").eq("org_id", orgA);
      expect(own.data).toHaveLength(1);

      const operator = await operatorA.client.from("subscriptions").select("org_id").eq("org_id", orgA);
      expect(operator.data ?? []).toHaveLength(0);

      const other = await ownerB.client.from("subscriptions").select("org_id").eq("org_id", orgA);
      expect(other.data ?? []).toHaveLength(0);
    });

    it("the owner cannot change the subscription", async () => {
      const { data } = await ownerA.client
        .from("subscriptions")
        .update({ discount_pct: 100, grace_days: 60 })
        .eq("org_id", orgA)
        .select();
      expect(data ?? []).toHaveLength(0);
      const sub = await subscriptionOf(orgA);
      expect(sub.discount_pct).toBeNull();
    });

    it("the lifecycle job is not callable by signed-in users", async () => {
      const { error } = await superadmin.client.rpc("run_subscription_lifecycle", { p_today: today });
      expect(error).not.toBeNull();
    });
  });

  describe("lifecycle with simulated dates", () => {
    it("a trial whose period ends today becomes past_due; one ending tomorrow stays", async () => {
      const due = await newOrg(await newUser("lcdue"), "lcdue");
      const notYet = await newOrg(await newUser("lcnotyet"), "lcnotyet");
      await setSubscription(due, { current_period_start: addDays(today, -7), current_period_end: today, grace_days: 5 });
      await setSubscription(notYet, { current_period_start: addDays(today, -6), current_period_end: addDays(today, 1) });

      await runLifecycle();

      expect((await subscriptionOf(due)).status).toBe("past_due");
      expect((await subscriptionOf(notYet)).status).toBe("trial");
    });

    it("past_due is suspended only once the grace days are over", async () => {
      const inGrace = await newOrg(await newUser("lcgrace"), "lcgrace");
      const over = await newOrg(await newUser("lcover"), "lcover");
      const lapsed = { status: "past_due", current_period_start: addDays(today, -32), current_period_end: addDays(today, -2) };
      await setSubscription(inGrace, { ...lapsed, grace_days: 3 });
      await setSubscription(over, { ...lapsed, grace_days: 2 });

      await runLifecycle();

      expect((await subscriptionOf(inGrace)).status).toBe("past_due");
      expect((await subscriptionOf(over)).status).toBe("suspended");
    });

    it("an active account long overdue goes to suspended in one run, and a second run changes nothing", async () => {
      const org = await newOrg(await newUser("lcactive"), "lcactive");
      await setSubscription(org, {
        status: "active",
        current_period_start: addDays(today, -40),
        current_period_end: addDays(today, -10),
        grace_days: 0,
      });

      await runLifecycle();
      const first = await subscriptionOf(org);
      await runLifecycle();
      const second = await subscriptionOf(org);

      expect(first.status).toBe("suspended");
      expect(second.status).toBe("suspended");
      expect(second.updated_at).toBe(first.updated_at);
    });
  });

  describe("invariant 6: suspended organization is read-only", () => {
    it("the owner still reads, but cannot invite or remove collaborators", async () => {
      const owner = await newUser("inv6owner");
      const operator = await newUser("inv6op");
      const org = await newOrg(owner, "inv6");
      const { token } = await invite(owner, org);
      expect((await operator.client.rpc("accept_invitation", { p_token: token })).error).toBeNull();

      const suspended = await superadmin.client.rpc("suspend_subscription", { p_org: org });
      expect(suspended.error).toBeNull();

      const orgRead = await owner.client.from("organizations").select("id").eq("id", org);
      expect(orgRead.data).toHaveLength(1);
      const members = await owner.client.from("memberships").select("user_id").eq("org_id", org);
      expect(members.data).toHaveLength(2);

      const invitation = await invite(owner, org);
      expect(invitation.error).not.toBeNull();

      const removed = await owner.client.from("memberships").delete().eq("org_id", org).eq("user_id", operator.id).select();
      expect(removed.data ?? []).toHaveLength(0);

      const active = await owner.client.rpc("org_access_active", { p_org: org });
      expect(active.data).toBe(false);
    });

    it("a lapsed account is read-only before the daily job runs", async () => {
      const owner = await newUser("inv6lapsed");
      const org = await newOrg(owner, "inv6lapsed");
      await setSubscription(org, {
        status: "trial",
        current_period_start: addDays(today, -8),
        current_period_end: addDays(today, -1),
        grace_days: 0,
      });

      const active = await owner.client.rpc("org_access_active", { p_org: org });
      expect(active.data).toBe(false);
      expect((await invite(owner, org)).error).not.toBeNull();
    });

    it("org_access_active is false for non-members", async () => {
      const { data } = await ownerB.client.rpc("org_access_active", { p_org: orgA });
      expect(data).toBe(false);
      const own = await ownerA.client.rpc("org_access_active", { p_org: orgA });
      expect(own.data).toBe(true);
    });
  });

  describe("manual payments", () => {
    it("only the platform admin records payments or suspends", async () => {
      const pay = await ownerA.client.rpc("record_subscription_payment", {
        p_org: orgA,
        p_amount_cents: 100,
        p_method: "cash",
        p_paid_at: today,
      });
      expect(pay.error?.message).toMatch(/platform admin required/);
      const suspend = await ownerA.client.rpc("suspend_subscription", { p_org: orgA });
      expect(suspend.error?.message).toMatch(/platform admin required/);
    });

    it("a payment in good standing extends from the end of the current period (anniversary)", async () => {
      const owner = await newUser("payok");
      const org = await newOrg(owner, "payok");
      const end = addDays(today, 5);
      await setSubscription(org, { status: "active", current_period_start: addMonths(end, -1), current_period_end: end });

      const { data: paymentId, error } = await superadmin.client.rpc("record_subscription_payment", {
        p_org: org,
        p_amount_cents: 1_500_000,
        p_method: "transfer",
        p_paid_at: today,
        p_months: 2,
        p_notes: "  transfer ref 123  ",
      });
      expect(error).toBeNull();

      const sub = await subscriptionOf(org);
      expect(sub.status).toBe("active");
      expect(sub.current_period_start).toBe(end);
      expect(sub.current_period_end).toBe(addMonths(end, 2));

      const { data: payment } = await admin.from("subscription_payments").select("*").eq("id", paymentId).single();
      expect(payment).toMatchObject({
        org_id: org,
        subscription_id: sub.id,
        amount_cents: 1_500_000,
        method: "transfer",
        paid_at: today,
        period_start: end,
        period_end: addMonths(end, 2),
        recorded_by: superadmin.id,
        notes: "transfer ref 123",
      });

      const ownerView = await owner.client.from("subscription_payments").select("id").eq("org_id", org);
      expect(ownerView.data).toHaveLength(1);
      const otherView = await ownerB.client.from("subscription_payments").select("id").eq("org_id", org);
      expect(otherView.data ?? []).toHaveLength(0);

      const { data: audit } = await admin
        .from("audit_log")
        .select("action")
        .eq("org_id", org)
        .eq("table_name", "subscription_payments");
      expect(audit).toEqual([{ action: "insert" }]);
    });

    it("a payment on a suspended account restarts on the payment date and reactivates it", async () => {
      const owner = await newUser("payreact");
      const org = await newOrg(owner, "payreact");
      expect((await superadmin.client.rpc("suspend_subscription", { p_org: org })).error).toBeNull();
      expect((await invite(owner, org)).error).not.toBeNull();

      const { error } = await superadmin.client.rpc("record_subscription_payment", {
        p_org: org,
        p_amount_cents: 1_000_000,
        p_method: "cash",
        p_paid_at: today,
      });
      expect(error).toBeNull();

      const sub = await subscriptionOf(org);
      expect(sub.status).toBe("active");
      expect(sub.current_period_start).toBe(today);
      expect(sub.current_period_end).toBe(addMonths(today, 1));
      expect((await owner.client.rpc("org_access_active", { p_org: org })).data).toBe(true);
      expect((await invite(owner, org)).error).toBeNull();
    });

    it("rejects a payment for zero or too many months and records nothing", async () => {
      for (const months of [0, 25]) {
        const { error } = await superadmin.client.rpc("record_subscription_payment", {
          p_org: orgB,
          p_amount_cents: 100,
          p_method: "cash",
          p_paid_at: today,
          p_months: months,
        });
        expect(error?.message).toMatch(/months must be between 1 and 24/);
      }
      const { count } = await admin
        .from("subscription_payments")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgB);
      expect(count).toBe(0);
    });
  });

  describe("plan limits", () => {
    it("an invitation cannot be accepted once the plan's collaborator cap is reached", async () => {
      const capped = await newPlan({ max_members: 2 });
      const owner = await newUser("capowner");
      const first = await newUser("capfirst");
      const second = await newUser("capsecond");
      const org = await newOrg(owner, "cap", capped);

      const one = await invite(owner, org);
      expect((await first.client.rpc("accept_invitation", { p_token: one.token })).error).toBeNull();

      const two = await invite(owner, org);
      const refused = await second.client.rpc("accept_invitation", { p_token: two.token });
      expect(refused.error?.message).toMatch(/member limit reached/);

      const { count } = await admin.from("memberships").select("user_id", { count: "exact", head: true }).eq("org_id", org);
      expect(count).toBe(2);
      const { data: inv } = await admin
        .from("invitations")
        .select("accepted_at")
        .eq("org_id", org)
        .is("accepted_at", null);
      expect(inv).toHaveLength(1);
    });

    it("the cap holds when several invitations are accepted at the same time", async () => {
      const capped = await newPlan({ max_members: 2 });
      const owner = await newUser("raceowner");
      const org = await newOrg(owner, "race", capped);
      const joiners = await Promise.all([1, 2, 3, 4].map((i) => newUser(`racer${i}`)));
      const tokens: string[] = [];
      for (let i = 0; i < joiners.length; i++) tokens.push((await invite(owner, org)).token);

      const results = await Promise.all(
        joiners.map((user, i) => user.client.rpc("accept_invitation", { p_token: tokens[i] })),
      );

      expect(results.filter((r) => r.error === null)).toHaveLength(1);
      const { count } = await admin.from("memberships").select("user_id", { count: "exact", head: true }).eq("org_id", org);
      expect(count).toBe(2);
    });
  });
});
