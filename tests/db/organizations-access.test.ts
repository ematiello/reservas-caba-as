import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  adminClient,
  anonClient,
  createTestUser,
  hasDbEnv,
  newToken,
  uniqueSlug,
  type TestUser,
} from "./helpers";

// Phase 1 invariants 4 and 5 (docs/03): org isolation and operator limits.
// Runs against the dev Supabase project with throwaway users and organizations.
describe.skipIf(!hasDbEnv)("organizations and access (RLS)", () => {
  let admin: SupabaseClient;
  const users: TestUser[] = [];
  const orgIds: string[] = [];

  let superadmin: TestUser;
  let ownerA: TestUser;
  let ownerB: TestUser;
  let operatorA: TestUser;
  let outsider: TestUser;
  let orgA: string;
  let orgB: string;

  async function newUser(label: string) {
    const user = await createTestUser(admin, label);
    users.push(user);
    return user;
  }

  async function register(user: TestUser, label: string) {
    const { data, error } = await user.client.rpc("register_organization", {
      p_name: `Org ${label}`,
      p_slug: uniqueSlug(label),
    });
    expect(error).toBeNull();
    orgIds.push(data as string);
    return data as string;
  }

  async function invite(owner: TestUser, org: string, role: "admin" | "operator") {
    const { token, hash } = newToken();
    const { error } = await owner.client
      .from("invitations")
      .insert({ org_id: org, role, token_hash: hash, created_by: owner.id });
    return { token, hash, error };
  }

  beforeAll(async () => {
    admin = adminClient();
    [superadmin, ownerA, ownerB, operatorA, outsider] = await Promise.all([
      newUser("super"),
      newUser("ownera"),
      newUser("ownerb"),
      newUser("opera"),
      newUser("outsider"),
    ]);
    await admin.from("platform_admins").insert({ user_id: superadmin.id });

    orgA = await register(ownerA, "a");
    orgB = await register(ownerB, "b");
    for (const org of [orgA, orgB]) {
      const { error } = await superadmin.client.rpc("review_organization", { p_org: org, p_approve: true });
      expect(error).toBeNull();
    }

    const { token } = await invite(ownerA, orgA, "operator");
    const accepted = await operatorA.client.rpc("accept_invitation", { p_token: token });
    expect(accepted.error).toBeNull();
  });

  afterAll(async () => {
    if (orgIds.length) {
      await admin.from("audit_log").delete().in("org_id", orgIds);
      await admin.from("organizations").delete().in("id", orgIds);
    }
    for (const user of users) await admin.auth.admin.deleteUser(user.id);
  });

  describe("registration and review", () => {
    it("creates the org as pending_approval with the caller as owner", async () => {
      const org = await register(outsider, "pend");
      const { data: row } = await outsider.client.from("organizations").select("status").eq("id", org).single();
      expect(row?.status).toBe("pending_approval");
      const { data: member } = await outsider.client.from("memberships").select("role").eq("org_id", org).single();
      expect(member?.role).toBe("owner");
    });

    it("rejects reserved and malformed slugs", async () => {
      for (const slug of ["admin", "Bad Slug", "ab"]) {
        const { error } = await outsider.client.rpc("register_organization", { p_name: "X Org", p_slug: slug });
        expect(error).not.toBeNull();
      }
    });

    it("lets only a platform admin review", async () => {
      const org = await register(outsider, "rev");
      const denied = await outsider.client.rpc("review_organization", { p_org: org, p_approve: true });
      expect(denied.error).not.toBeNull();
      const ok = await superadmin.client.rpc("review_organization", { p_org: org, p_approve: false });
      expect(ok.error).toBeNull();
      const { data } = await admin.from("organizations").select("status, approved_at").eq("id", org).single();
      expect(data?.status).toBe("rejected");
      expect(data?.approved_at).toBeNull();
    });

    it("does not allow direct writes to organizations", async () => {
      const insert = await ownerA.client.from("organizations").insert({ name: "Hack", slug: uniqueSlug("hack") });
      expect(insert.error).not.toBeNull();
      await ownerA.client.from("organizations").update({ status: "rejected" }).eq("id", orgA);
      const { data } = await admin.from("organizations").select("status").eq("id", orgA).single();
      expect(data?.status).toBe("active");
    });
  });

  // Invariant 4: org A cannot read or write anything of org B.
  describe("isolation between organizations", () => {
    it("hides org B rows from org A in every table", async () => {
      await invite(ownerB, orgB, "admin");
      const checks: [string, string][] = [
        ["organizations", "id"],
        ["memberships", "org_id"],
        ["invitations", "org_id"],
        ["audit_log", "org_id"],
      ];
      for (const [table, column] of checks) {
        const { data, error } = await ownerA.client.from(table).select("*").eq(column, orgB);
        expect(error).toBeNull();
        expect(data, table).toEqual([]);
      }
    });

    it("blocks org A from writing into org B", async () => {
      const inv = await ownerA.client
        .from("invitations")
        .insert({ org_id: orgB, role: "admin", token_hash: newToken().hash, created_by: ownerA.id });
      expect(inv.error).not.toBeNull();

      await ownerA.client.from("memberships").update({ role: "operator" }).eq("org_id", orgB);
      await ownerA.client.from("memberships").delete().eq("org_id", orgB);
      const { data } = await admin.from("memberships").select("role").eq("org_id", orgB);
      expect(data).toEqual([{ role: "owner" }]);
    });

    it("shows a user only their own organizations", async () => {
      const { data } = await ownerA.client.from("organizations").select("id");
      expect(data?.map((r) => r.id)).toEqual([orgA]);
    });

    it("exposes nothing to anon", async () => {
      const anon = anonClient();
      for (const table of ["organizations", "memberships", "invitations", "audit_log", "profiles", "platform_admins"]) {
        const { data } = await anon.from(table).select("*");
        expect(data ?? [], table).toEqual([]);
      }
    });
  });

  // Invariant 5: an operator cannot modify memberships (tarifas/unidades arrive in later phases).
  describe("operator limits", () => {
    it("lets the operator read the org but not manage collaborators", async () => {
      const { data } = await operatorA.client.from("memberships").select("user_id").eq("org_id", orgA);
      expect(data?.length).toBe(2);

      const del = await operatorA.client.from("memberships").delete().eq("user_id", ownerA.id);
      await operatorA.client.from("memberships").update({ role: "admin" }).eq("user_id", operatorA.id);
      expect(del.error).toBeNull(); // RLS filters silently: nothing deleted
      const { data: after } = await admin.from("memberships").select("user_id, role").eq("org_id", orgA);
      expect(after).toHaveLength(2);
      expect(after?.find((m) => m.user_id === operatorA.id)?.role).toBe("operator");
    });

    it("blocks the operator from creating or reading invitations", async () => {
      const attempt = await invite(operatorA, orgA, "admin");
      expect(attempt.error).not.toBeNull();
      const { data } = await operatorA.client.from("invitations").select("id");
      expect(data).toEqual([]);
    });

    it("blocks the operator from reading the audit log", async () => {
      const { data } = await operatorA.client.from("audit_log").select("id");
      expect(data).toEqual([]);
    });
  });

  describe("collaborators (owner only)", () => {
    it("never lets an owner row be demoted, removed or created", async () => {
      await ownerA.client.from("memberships").update({ role: "operator" }).eq("user_id", ownerA.id);
      await ownerA.client.from("memberships").delete().eq("user_id", ownerA.id);
      const promote = await ownerA.client.from("memberships").update({ role: "owner" }).eq("user_id", operatorA.id);
      const insert = await ownerA.client
        .from("memberships")
        .insert({ org_id: orgA, user_id: outsider.id, role: "admin" });
      expect(insert.error).not.toBeNull();
      expect(promote.error).not.toBeNull(); // WITH CHECK rejects role = owner
      const { data } = await admin.from("memberships").select("user_id, role").eq("org_id", orgA);
      expect(data?.find((m) => m.user_id === ownerA.id)?.role).toBe("owner");
      expect(data?.find((m) => m.user_id === operatorA.id)?.role).toBe("operator");
    });

    it("lets the owner change a collaborator role and remove them", async () => {
      const member = await newUser("member");
      const { token } = await invite(ownerA, orgA, "operator");
      expect((await member.client.rpc("accept_invitation", { p_token: token })).error).toBeNull();

      const up = await ownerA.client.from("memberships").update({ role: "admin" }).eq("user_id", member.id).select();
      expect(up.data?.[0]?.role).toBe("admin");
      const del = await ownerA.client.from("memberships").delete().eq("user_id", member.id).select();
      expect(del.data).toHaveLength(1);
    });
  });

  describe("invitation links", () => {
    it("accepts a valid token once and stores only its hash", async () => {
      const invitee = await newUser("invitee");
      const { token, hash } = await invite(ownerA, orgA, "admin");
      const { data: stored } = await ownerA.client.from("invitations").select("token_hash").eq("token_hash", hash);
      expect(stored).toHaveLength(1);
      expect(JSON.stringify(stored)).not.toContain(token);

      const first = await invitee.client.rpc("accept_invitation", { p_token: token });
      expect(first.error).toBeNull();
      expect(first.data).toBe(orgA);
      const second = await outsider.client.rpc("accept_invitation", { p_token: token });
      expect(second.error).not.toBeNull();
    });

    it("rejects unknown, expired and revoked tokens", async () => {
      expect((await outsider.client.rpc("accept_invitation", { p_token: "nope" })).error).not.toBeNull();

      const expired = await invite(ownerA, orgA, "operator");
      const aged = await admin
        .from("invitations")
        // A day in the past: immune to clock skew between this machine and the database.
        .update({ expires_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString() })
        .eq("token_hash", expired.hash)
        .select("id");
      expect(aged.error).toBeNull();
      expect(aged.data).toHaveLength(1);
      expect((await outsider.client.rpc("accept_invitation", { p_token: expired.token })).error).not.toBeNull();

      const revoked = await invite(ownerA, orgA, "operator");
      const rev = await ownerA.client
        .from("invitations")
        .update({ revoked_at: new Date().toISOString() })
        .eq("token_hash", revoked.hash)
        .select();
      expect(rev.data).toHaveLength(1);
      expect((await outsider.client.rpc("accept_invitation", { p_token: revoked.token })).error).not.toBeNull();
    });

    it("does not downgrade an existing member", async () => {
      const { token } = await invite(ownerA, orgA, "admin");
      await operatorA.client.rpc("accept_invitation", { p_token: token });
      const { data } = await admin.from("memberships").select("role").eq("org_id", orgA).eq("user_id", operatorA.id).single();
      expect(data?.role).toBe("operator");
    });

    it("requires authentication", async () => {
      const { error } = await anonClient().rpc("accept_invitation", { p_token: "x" });
      expect(error).not.toBeNull();
    });

    it("does not let a pending organization create invitations", async () => {
      const pendingOwner = await newUser("pendowner");
      const pending = await register(pendingOwner, "pend2");
      const attempt = await invite(pendingOwner, pending, "admin");
      expect(attempt.error).not.toBeNull();
    });
  });

  describe("audit log", () => {
    it("records org and membership changes for the owner and the superadmin", async () => {
      const { data } = await ownerA.client.from("audit_log").select("table_name, action").eq("org_id", orgA);
      const tables = new Set(data?.map((r) => r.table_name));
      expect(tables.has("organizations")).toBe(true);
      expect(tables.has("memberships")).toBe(true);

      const asSuper = await superadmin.client.from("audit_log").select("id").eq("org_id", orgA);
      expect(asSuper.data?.length).toBeGreaterThan(0);
    });

    it("is insert-only for clients", async () => {
      const writers: SupabaseClient[] = [ownerA.client, superadmin.client];
      for (const client of writers) {
        const ins = await client.from("audit_log").insert({ action: "x", table_name: "x" });
        expect(ins.error).not.toBeNull();
        await client.from("audit_log").update({ action: "tampered" }).eq("org_id", orgA);
        await client.from("audit_log").delete().eq("org_id", orgA);
      }
      const { data } = await admin.from("audit_log").select("action").eq("org_id", orgA);
      expect(data?.length).toBeGreaterThan(0);
      expect(data?.some((r) => r.action === "tampered")).toBe(false);
    });
  });
});
