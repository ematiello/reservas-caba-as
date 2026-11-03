import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { adminClient, anonClient, assertDbEnv, createTestUser, uniqueSlug, type TestUser } from "./helpers";

// Error log for the platform admin (odd/tasks/panel-errores-y-limpieza-dev.md, S1): grouping by
// fingerprint, server-only writes, platform-admin-only reads and triage, audit trail and retention.
assertDbEnv();
const skipDb = process.env.SKIP_DB_TESTS === "1";

describe.skipIf(skipDb)("error log", () => {
  let admin: SupabaseClient;
  const users: TestUser[] = [];
  let superadmin: TestUser;
  let owner: TestUser;
  let orgId: string;
  const prefix = uniqueSlug("errlog");
  const fingerprints: string[] = [];

  function entry(label: string, extra: Record<string, unknown> = {}) {
    const fingerprint = `${prefix}-${label}`;
    fingerprints.push(fingerprint);
    return {
      p_fingerprint: fingerprint,
      p_source: "server",
      p_severity: "error",
      p_message: `Boom ${label}`,
      ...extra,
    };
  }

  async function rowOf(label: string) {
    const { data, error } = await admin.from("error_log").select("*").eq("fingerprint", `${prefix}-${label}`).maybeSingle();
    expect(error).toBeNull();
    return data;
  }

  beforeAll(async () => {
    admin = adminClient();
    superadmin = await createTestUser(admin, "errsuper");
    owner = await createTestUser(admin, "errowner");
    users.push(superadmin, owner);
    await admin.from("platform_admins").insert({ user_id: superadmin.id });
    const { data, error } = await owner.client.rpc("register_organization", { p_name: "Org errores", p_slug: uniqueSlug("errorg") });
    expect(error).toBeNull();
    orgId = data as string;
  });

  afterAll(async () => {
    const { data: rows } = await admin.from("error_log").select("id").in("fingerprint", fingerprints);
    const ids = (rows ?? []).map((r) => String(r.id));
    if (ids.length) await admin.from("audit_log").delete().eq("table_name", "error_log").in("record_id", ids);
    await admin.from("error_log").delete().in("fingerprint", fingerprints);
    await admin.from("audit_log").delete().eq("org_id", orgId);
    await admin.from("organizations").delete().eq("id", orgId);
    const userIds = users.map((u) => u.id);
    await admin.from("platform_admins").delete().in("user_id", userIds);
    await admin.from("audit_log").delete().eq("table_name", "platform_admins").in("record_id", userIds);
    for (const user of users) await admin.auth.admin.deleteUser(user.id);
  });

  describe("writing", () => {
    it("stores an error once and counts the repeats instead of adding rows", async () => {
      for (let i = 0; i < 3; i++) {
        const { error } = await admin.rpc("log_error", entry("grouped", { p_route: "/panel/reservas" }));
        expect(error).toBeNull();
      }
      const { count } = await admin.from("error_log").select("id", { count: "exact", head: true }).eq("fingerprint", `${prefix}-grouped`);
      expect(count).toBe(1);
      expect(await rowOf("grouped")).toMatchObject({ count: 3, status: "open", source: "server", route: "/panel/reservas" });
    });

    it("caps the stored lengths even if the app sent more", async () => {
      const { error } = await admin.rpc("log_error", entry("long", { p_message: "m".repeat(900), p_detail: "d".repeat(9000) }));
      expect(error).toBeNull();
      const row = await rowOf("long");
      expect(row?.message).toHaveLength(500);
      expect(row?.detail).toHaveLength(4000);
    });

    it("is closed to browsers: neither anonymous visitors nor signed-in users can log or write", async () => {
      for (const client of [anonClient(), owner.client, superadmin.client]) {
        const rpc = await client.rpc("log_error", entry("forged"));
        expect(rpc.error).not.toBeNull();
        const insert = await client.from("error_log").insert({ fingerprint: `${prefix}-forged`, source: "server", message: "x" });
        expect(insert.error).not.toBeNull();
      }
      expect(await rowOf("forged")).toBeNull();
    });
  });

  describe("reading and triage", () => {
    it("shows the log to the platform admin only", async () => {
      const seen = await superadmin.client.from("error_log").select("fingerprint").eq("fingerprint", `${prefix}-grouped`);
      expect(seen.error).toBeNull();
      expect(seen.data).toHaveLength(1);
      const hidden = await owner.client.from("error_log").select("fingerprint").eq("fingerprint", `${prefix}-grouped`);
      expect(hidden.data ?? []).toEqual([]);
      const anon = await anonClient().from("error_log").select("fingerprint").limit(1);
      expect(anon.error).not.toBeNull();
    });

    it("lets the platform admin resolve, ignore and reopen, leaving an audit trail without organization", async () => {
      const id = (await rowOf("grouped"))!.id;
      const resolved = await superadmin.client.rpc("set_error_status", { p_id: id, p_status: "resolved" });
      expect(resolved.error).toBeNull();
      expect(await rowOf("grouped")).toMatchObject({ status: "resolved", resolved_by: superadmin.id });

      expect((await superadmin.client.rpc("set_error_status", { p_id: id, p_status: "ignored" })).error).toBeNull();
      expect((await superadmin.client.rpc("set_error_status", { p_id: id, p_status: "open" })).error).toBeNull();
      expect(await rowOf("grouped")).toMatchObject({ status: "open", resolved_by: null, resolved_at: null });

      const { data: audit } = await admin.from("audit_log").select("org_id, actor_id, diff").eq("table_name", "error_log").eq("record_id", String(id));
      expect(audit).toHaveLength(3);
      expect(audit!.every((r) => r.org_id === null && r.actor_id === superadmin.id)).toBe(true);

      const ownerView = await owner.client.rpc("audit_entries", { p_org: orgId, p_limit: 200 });
      expect(ownerView.error).toBeNull();
      expect((ownerView.data as { table_name: string }[]).some((r) => r.table_name === "error_log")).toBe(false);
    });

    it("rejects an unknown status, an unknown error and anyone who is not a platform admin", async () => {
      const id = (await rowOf("grouped"))!.id;
      expect((await superadmin.client.rpc("set_error_status", { p_id: id, p_status: "deleted" })).error?.code).toBe("22023");
      expect((await superadmin.client.rpc("set_error_status", { p_id: 999999999, p_status: "open" })).error?.code).toBe("P0002");
      expect((await owner.client.rpc("set_error_status", { p_id: id, p_status: "resolved" })).error?.code).toBe("42501");
      expect((await anonClient().rpc("set_error_status", { p_id: id, p_status: "resolved" })).error).not.toBeNull();
    });

    it("reopens a resolved error when it happens again", async () => {
      expect((await admin.rpc("log_error", entry("recurs"))).error).toBeNull();
      const id = (await rowOf("recurs"))!.id;
      expect((await superadmin.client.rpc("set_error_status", { p_id: id, p_status: "resolved" })).error).toBeNull();
      expect((await admin.rpc("log_error", entry("recurs"))).error).toBeNull();
      expect(await rowOf("recurs")).toMatchObject({ status: "open", count: 2, resolved_by: null, resolved_at: null });
    });

    it("keeps an ignored error ignored when it repeats", async () => {
      expect((await admin.rpc("log_error", entry("noise"))).error).toBeNull();
      const id = (await rowOf("noise"))!.id;
      expect((await superadmin.client.rpc("set_error_status", { p_id: id, p_status: "ignored" })).error).toBeNull();
      expect((await admin.rpc("log_error", entry("noise"))).error).toBeNull();
      expect(await rowOf("noise")).toMatchObject({ status: "ignored", count: 2 });
    });
  });

  describe("retention", () => {
    it("purges resolved errors after 90 days and any error after 180, never recent open ones", async () => {
      for (const label of ["old-resolved", "old-open", "very-old-open", "recent-open"]) {
        expect((await admin.rpc("log_error", entry(label))).error).toBeNull();
      }
      const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
      const age = (label: string, status: string, days: number) =>
        admin.from("error_log").update({ status, last_at: daysAgo(days) }).eq("fingerprint", `${prefix}-${label}`);
      await age("old-resolved", "resolved", 100);
      await age("old-open", "open", 100);
      await age("very-old-open", "open", 200);

      const purged = await admin.rpc("purge_error_log");
      expect(purged.error).toBeNull();
      expect(await rowOf("old-resolved")).toBeNull();
      expect(await rowOf("very-old-open")).toBeNull();
      expect(await rowOf("old-open")).not.toBeNull();
      expect(await rowOf("recent-open")).not.toBeNull();

      expect((await owner.client.rpc("purge_error_log")).error).not.toBeNull();
    });
  });
});
