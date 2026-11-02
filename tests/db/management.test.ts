import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { adminClient, assertDbEnv, createTestUser, newToken, uniqueSlug, type TestUser } from "./helpers";

// Management features for owners and the platform admin (odd/tasks/gestion-propietario-superadmin.md):
// organization edits, cancel/reactivate, deactivation, platform admins, own holidays and the audit log.
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

describe.skipIf(skipDb)("management (owner and platform admin)", () => {
  let admin: SupabaseClient;
  const users: TestUser[] = [];
  const orgIds: string[] = [];

  let superadmin: TestUser;
  let ownerA: TestUser;
  let operatorA: TestUser;
  let ownerB: TestUser;
  let orgA: string;
  let orgB: string;
  let slugA: string;
  const today = todayAr();

  async function newUser(label: string) {
    const user = await createTestUser(admin, label);
    users.push(user);
    return user;
  }

  async function newOrg(owner: TestUser, label: string) {
    const slug = uniqueSlug(label);
    const { data, error } = await owner.client.rpc("register_organization", { p_name: `Org ${label}`, p_slug: slug });
    expect(error).toBeNull();
    const org = data as string;
    orgIds.push(org);
    const approved = await superadmin.client.rpc("review_organization", { p_org: org, p_approve: true });
    expect(approved.error).toBeNull();
    return { org, slug };
  }

  async function accessActive(user: TestUser, org: string) {
    const { data, error } = await user.client.rpc("org_access_active", { p_org: org });
    expect(error).toBeNull();
    return data as boolean;
  }

  async function subscriptionOf(org: string) {
    const { data, error } = await admin.from("subscriptions").select("*").eq("org_id", org).single();
    expect(error).toBeNull();
    return data;
  }

  beforeAll(async () => {
    admin = adminClient();
    [superadmin, ownerA, operatorA, ownerB] = await Promise.all([
      newUser("mgsuper"),
      newUser("mgownera"),
      newUser("mgopera"),
      newUser("mgownerb"),
    ]);
    await admin.from("platform_admins").insert({ user_id: superadmin.id });
    ({ org: orgA, slug: slugA } = await newOrg(ownerA, "mga"));
    ({ org: orgB } = await newOrg(ownerB, "mgb"));
    const { token, hash } = newToken();
    const invited = await ownerA.client
      .from("invitations")
      .insert({ org_id: orgA, role: "operator", token_hash: hash, created_by: ownerA.id });
    expect(invited.error).toBeNull();
    const accepted = await operatorA.client.rpc("accept_invitation", { p_token: token });
    expect(accepted.error).toBeNull();
  });

  afterAll(async () => {
    if (orgIds.length) {
      await admin.from("audit_log").delete().in("org_id", orgIds);
      await admin.from("organizations").delete().in("id", orgIds);
    }
    const ids = users.map((u) => u.id);
    await admin.from("platform_admins").delete().in("user_id", ids);
    await admin.from("audit_log").delete().eq("table_name", "platform_admins").in("record_id", ids);
    for (const user of users) await admin.auth.admin.deleteUser(user.id);
  });

  describe("organization data", () => {
    it("lets the owner rename the organization but not change its address", async () => {
      const renamed = await ownerA.client.rpc("update_organization", { p_org: orgA, p_name: "Cabañas del Arroyo" });
      expect(renamed.error).toBeNull();
      const { data } = await admin.from("organizations").select("name, slug").eq("id", orgA).single();
      expect(data).toEqual({ name: "Cabañas del Arroyo", slug: slugA });

      const slug = await ownerA.client.rpc("update_organization", { p_org: orgA, p_name: "X Y", p_slug: uniqueSlug("own") });
      expect(slug.error?.code).toBe("42501");
    });

    it("rejects collaborators and owners of another organization", async () => {
      for (const user of [operatorA, ownerB]) {
        const { error } = await user.client.rpc("update_organization", { p_org: orgA, p_name: "Hijacked" });
        expect(error?.code).toBe("42501");
      }
    });

    it("lets the platform admin change the name and the address", async () => {
      const slug = uniqueSlug("mgnew");
      const { error } = await superadmin.client.rpc("update_organization", { p_org: orgA, p_name: "Arroyo Verde", p_slug: slug });
      expect(error).toBeNull();
      const { data } = await admin.from("organizations").select("name, slug").eq("id", orgA).single();
      expect(data).toEqual({ name: "Arroyo Verde", slug });
      slugA = slug;
    });

    it("rejects an address already in use", async () => {
      const { data: b } = await admin.from("organizations").select("slug").eq("id", orgB).single();
      const { error } = await superadmin.client.rpc("update_organization", { p_org: orgA, p_name: "Arroyo Verde", p_slug: b!.slug });
      expect(error?.code).toBe("23505");
    });
  });

  describe("deactivation", () => {
    it("turns the organization read-only until the platform admin turns it back on", async () => {
      expect(await accessActive(ownerA, orgA)).toBe(true);
      const off = await superadmin.client.rpc("set_organization_disabled", { p_org: orgA, p_disabled: true });
      expect(off.error).toBeNull();
      expect(await accessActive(ownerA, orgA)).toBe(false);
      const rename = await ownerA.client.rpc("update_organization", { p_org: orgA, p_name: "While off" });
      expect(rename.error?.code).toBe("42501");

      const on = await superadmin.client.rpc("set_organization_disabled", { p_org: orgA, p_disabled: false });
      expect(on.error).toBeNull();
      expect(await accessActive(ownerA, orgA)).toBe(true);
    });

    it("is a platform admin action only", async () => {
      const { error } = await ownerA.client.rpc("set_organization_disabled", { p_org: orgA, p_disabled: true });
      expect(error?.code).toBe("42501");
    });
  });

  describe("cancel and reactivate the subscription", () => {
    it("rejects a cancellation by a collaborator or another owner", async () => {
      for (const user of [operatorA, ownerB]) {
        const { error } = await user.client.rpc("cancel_subscription", { p_org: orgA });
        expect(error?.code).toBe("42501");
      }
      expect((await subscriptionOf(orgA)).status).toBe("trial");
    });

    it("lets the owner cancel: the account turns read-only and keeps its data", async () => {
      const { error } = await ownerA.client.rpc("cancel_subscription", { p_org: orgA });
      expect(error).toBeNull();
      expect((await subscriptionOf(orgA)).status).toBe("cancelled");
      expect(await accessActive(ownerA, orgA)).toBe(false);
      const { data } = await admin.from("organizations").select("id").eq("id", orgA);
      expect(data).toHaveLength(1);
      const again = await ownerA.client.rpc("cancel_subscription", { p_org: orgA });
      expect(again.error?.code).toBe("P0002");
    });

    it("does not let the owner reactivate", async () => {
      const { error } = await ownerA.client.rpc("reactivate_subscription", { p_org: orgA, p_until: addDays(today, 30) });
      expect(error?.code).toBe("42501");
    });

    it("lets the platform admin reactivate until a date, without a payment", async () => {
      const until = addDays(today, 30);
      const { error } = await superadmin.client.rpc("reactivate_subscription", { p_org: orgA, p_until: until });
      expect(error).toBeNull();
      const sub = await subscriptionOf(orgA);
      expect(sub).toMatchObject({ status: "active", current_period_start: today, current_period_end: until });
      expect(await accessActive(ownerA, orgA)).toBe(true);
    });

    it("rejects a reactivation date that is not in the future", async () => {
      await superadmin.client.rpc("cancel_subscription", { p_org: orgA });
      const { error } = await superadmin.client.rpc("reactivate_subscription", { p_org: orgA, p_until: today });
      expect(error?.code).toBe("22023");
      const ok = await superadmin.client.rpc("reactivate_subscription", { p_org: orgA, p_until: addDays(today, 10) });
      expect(ok.error).toBeNull();
    });
  });

  describe("platform admins", () => {
    it("lets a platform admin add another one by email, and lists them", async () => {
      const { error } = await superadmin.client.rpc("grant_platform_admin", { p_email: ownerB.email.toUpperCase() });
      expect(error).toBeNull();
      const { data: own } = await ownerB.client.from("platform_admins").select("user_id");
      expect(own).toEqual([{ user_id: ownerB.id }]);

      const { data: list, error: listError } = await superadmin.client.rpc("list_platform_admins");
      expect(listError).toBeNull();
      const emails = (list as { email: string }[]).map((r) => r.email);
      expect(emails).toEqual(expect.arrayContaining([superadmin.email, ownerB.email]));
    });

    it("rejects an unknown email", async () => {
      const { error } = await superadmin.client.rpc("grant_platform_admin", { p_email: "nadie-xyz@example.com" });
      expect(error?.code).toBe("P0002");
    });

    it("never lets an admin remove themselves, and removes another one", async () => {
      const self = await superadmin.client.rpc("revoke_platform_admin", { p_user: superadmin.id });
      expect(self.error?.code).toBe("P0001");
      const other = await superadmin.client.rpc("revoke_platform_admin", { p_user: ownerB.id });
      expect(other.error).toBeNull();
      const { data } = await ownerB.client.from("platform_admins").select("user_id");
      expect(data).toEqual([]);
    });

    it("is closed to everyone else", async () => {
      const grant = await ownerA.client.rpc("grant_platform_admin", { p_email: ownerA.email });
      expect(grant.error?.code).toBe("42501");
      const list = await ownerA.client.rpc("list_platform_admins");
      expect(list.error?.code).toBe("42501");
    });
  });

  describe("holidays of an organization", () => {
    const date = "2031-05-02";

    it("lets the owner load a holiday that only their organization sees", async () => {
      const { error } = await ownerA.client.from("holidays").insert({ org_id: orgA, date, name: "Fiesta patronal" });
      expect(error).toBeNull();
      const own = await ownerA.client.from("holidays").select("name").eq("org_id", orgA);
      expect(own.data).toEqual([{ name: "Fiesta patronal" }]);
      const other = await ownerB.client.from("holidays").select("name").eq("org_id", orgA);
      expect(other.data).toEqual([]);
    });

    it("allows a national holiday on the same date, but not the same date twice for the organization", async () => {
      await admin.from("holidays").delete().is("org_id", null).eq("date", date);
      const national = await superadmin.client.from("holidays").insert({ date, name: "Nacional de prueba" });
      expect(national.error).toBeNull();
      const twice = await ownerA.client.from("holidays").insert({ org_id: orgA, date, name: "Otra" });
      expect(twice.error?.code).toBe("23505");
      await admin.from("holidays").delete().is("org_id", null).eq("date", date);
    });

    it("rejects national holidays, other organizations and operators", async () => {
      const national = await ownerA.client.from("holidays").insert({ date: "2031-05-03", name: "Nacional" });
      expect(national.error).not.toBeNull();
      const foreign = await ownerB.client.from("holidays").insert({ org_id: orgA, date: "2031-05-04", name: "Ajeno" });
      expect(foreign.error).not.toBeNull();
      const operator = await operatorA.client.from("holidays").insert({ org_id: orgA, date: "2031-05-05", name: "Op" });
      expect(operator.error).not.toBeNull();
      const removed = await ownerB.client.from("holidays").delete().eq("org_id", orgA).select("id");
      expect(removed.data).toEqual([]);
    });
  });

  describe("audit log", () => {
    it("shows the owner the changes of their organization, with who made them", async () => {
      const { data, error } = await ownerA.client.rpc("audit_entries", { p_org: orgA });
      expect(error).toBeNull();
      const rows = data as { table_name: string; action: string; actor: string | null }[];
      expect(rows.some((r) => r.table_name === "organizations" && r.action === "update")).toBe(true);
      expect(rows.some((r) => r.table_name === "subscriptions" && r.actor === "Test mgownera")).toBe(true);
    });

    it("hides the log from collaborators and other owners, and the platform-wide log from owners", async () => {
      for (const user of [operatorA, ownerB]) {
        const { error } = await user.client.rpc("audit_entries", { p_org: orgA });
        expect(error?.code).toBe("42501");
      }
      const all = await ownerA.client.rpc("audit_entries");
      expect(all.error?.code).toBe("42501");
    });

    it("records each time the platform admin opens an organization's bookings or guests", async () => {
      const { error } = await superadmin.client.rpc("log_admin_access", { p_org: orgB, p_area: "guests" });
      expect(error).toBeNull();
      const { data } = await superadmin.client.rpc("audit_entries", { p_org: orgB });
      const view = (data as { action: string; table_name: string; actor_id: string }[]).find((r) => r.action === "view");
      expect(view).toMatchObject({ table_name: "guests", actor_id: superadmin.id });

      const denied = await ownerA.client.rpc("log_admin_access", { p_org: orgA, p_area: "guests" });
      expect(denied.error?.code).toBe("42501");
    });

    it("audits properties, categories and units, so the owner sees them in the activity", async () => {
      const property = await admin
        .from("properties")
        .insert({ org_id: orgB, name: "Audited", slug: uniqueSlug("aud") })
        .select("id")
        .single();
      expect(property.error).toBeNull();
      const propertyId = property.data!.id as string;
      const category = await admin.from("unit_categories").insert({ org_id: orgB, property_id: propertyId, name: "Suites" });
      expect(category.error).toBeNull();
      const unit = await admin
        .from("units")
        .insert({ org_id: orgB, property_id: propertyId, name: "U1", kind: "cabin", max_guests: 2 });
      expect(unit.error).toBeNull();
      expect((await admin.from("properties").delete().eq("id", propertyId)).error).toBeNull();

      const { data, error } = await ownerB.client.rpc("audit_entries", { p_org: orgB, p_limit: 200 });
      expect(error).toBeNull();
      const seen = new Set((data as { action: string; table_name: string }[]).map((r) => `${r.action}:${r.table_name}`));
      for (const key of [
        "insert:properties",
        "insert:unit_categories",
        "insert:units",
        "delete:properties",
        "delete:unit_categories",
        "delete:units",
      ]) {
        expect(seen.has(key), key).toBe(true);
      }
    });

    it("gives the platform admin the log of every organization", async () => {
      const { data, error } = await superadmin.client.rpc("audit_entries", { p_limit: 200 });
      expect(error).toBeNull();
      expect((data as unknown[]).length).toBeGreaterThan(0);
    });
  });
});
