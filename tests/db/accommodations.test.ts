import { randomBytes } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { adminClient, anonClient, assertDbEnv, createTestUser, newToken, uniqueSlug, type TestUser } from "./helpers";

// Phase 3: properties, categories, units, amenities, media and Storage.
// Invariants 4 (isolation), 5 (operators cannot change units) and 6 (suspended = read-only).
assertDbEnv();
const skipDb = process.env.SKIP_DB_TESTS === "1";

// Smallest valid JPEG is not needed: Storage checks the declared content type, not the bytes.
const jpeg = new Blob([randomBytes(64)], { type: "image/jpeg" });

describe.skipIf(skipDb)("accommodations (Phase 3)", () => {
  let admin: SupabaseClient;
  const users: TestUser[] = [];
  const orgIds: string[] = [];
  const planIds: string[] = [];
  const objects: string[] = [];

  let superadmin: TestUser;
  let ownerA: TestUser;
  let operatorA: TestUser;
  let ownerB: TestUser;
  let orgA: string;
  let orgB: string;
  let propA: string;
  let propB: string;
  let unitA: string;

  async function newUser(label: string) {
    const user = await createTestUser(admin, label);
    users.push(user);
    return user;
  }

  async function newOrg(owner: TestUser, label: string, plan?: string) {
    const { data, error } = await owner.client.rpc("register_organization", {
      p_name: `Org ${label}`,
      p_slug: uniqueSlug(label),
    });
    expect(error).toBeNull();
    orgIds.push(data as string);
    const approved = await superadmin.client.rpc("review_organization", {
      p_org: data,
      p_approve: true,
      ...(plan ? { p_plan: plan } : {}),
    });
    expect(approved.error).toBeNull();
    return data as string;
  }

  async function newProperty(client: SupabaseClient, org: string, published = false) {
    return client
      .from("properties")
      .insert({ org_id: org, slug: uniqueSlug("prop"), name: "Cabañas del Lago", is_published: published })
      .select("id")
      .single();
  }

  async function newUnit(client: SupabaseClient, org: string, property: string, values: Record<string, unknown> = {}) {
    return client
      .from("units")
      .insert({ org_id: org, property_id: property, kind: "cabin", name: "Cabaña 1", max_guests: 4, ...values })
      .select("id")
      .single();
  }

  beforeAll(async () => {
    admin = adminClient();
    [superadmin, ownerA, operatorA, ownerB] = await Promise.all([
      newUser("accsuper"),
      newUser("accownera"),
      newUser("accopa"),
      newUser("accownerb"),
    ]);
    await admin.from("platform_admins").insert({ user_id: superadmin.id });
    orgA = await newOrg(ownerA, "acca");
    orgB = await newOrg(ownerB, "accb");

    const { token, hash } = newToken();
    await ownerA.client.from("invitations").insert({ org_id: orgA, role: "operator", token_hash: hash, created_by: ownerA.id });
    expect((await operatorA.client.rpc("accept_invitation", { p_token: token })).error).toBeNull();

    const a = await newProperty(ownerA.client, orgA);
    expect(a.error).toBeNull();
    propA = a.data!.id;
    const b = await newProperty(ownerB.client, orgB);
    expect(b.error).toBeNull();
    propB = b.data!.id;
    const unit = await newUnit(ownerA.client, orgA, propA);
    expect(unit.error).toBeNull();
    unitA = unit.data!.id;
  });

  afterAll(async () => {
    if (objects.length) await admin.storage.from("media").remove(objects);
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

  describe("invariant 4: isolation", () => {
    it("organization B cannot read A's properties, units or categories", async () => {
      await ownerA.client.from("unit_categories").insert({ org_id: orgA, property_id: propA, name: "Dobles" });
      for (const table of ["properties", "units", "unit_categories"] as const) {
        const { data } = await ownerB.client.from(table).select("id").eq("org_id", orgA);
        expect(data ?? [], table).toHaveLength(0);
      }
    });

    it("organization B cannot write into A", async () => {
      expect((await newProperty(ownerB.client, orgA)).error).not.toBeNull();
      expect((await newUnit(ownerB.client, orgA, propA)).error).not.toBeNull();
      const update = await ownerB.client.from("properties").update({ name: "Hackeado" }).eq("id", propA).select();
      expect(update.data ?? []).toHaveLength(0);
      const del = await ownerB.client.from("units").delete().eq("id", unitA).select();
      expect(del.data ?? []).toHaveLength(0);
    });

    it("a row cannot point at another organization's property", async () => {
      // B manages its own org_id but references A's property: the composite key refuses it.
      const { error } = await newUnit(ownerB.client, orgB, propA);
      expect(error).not.toBeNull();
    });

    it("a unit's category must belong to the same property", async () => {
      const other = await newProperty(ownerA.client, orgA);
      const { data: category } = await ownerA.client
        .from("unit_categories")
        .insert({ org_id: orgA, property_id: other.data!.id, name: "Suites" })
        .select("id")
        .single();
      const { error } = await newUnit(ownerA.client, orgA, propA, { category_id: category!.id });
      expect(error?.code).toBe("23503");
    });

    it("a photo cannot point at a unit of another property", async () => {
      const other = await newProperty(ownerA.client, orgA);
      const { error } = await ownerA.client.from("media").insert({
        org_id: orgA,
        property_id: other.data!.id,
        unit_id: unitA,
        storage_path: `${orgA}/${other.data!.id}/00000000-0000-4000-8000-000000000000.webp`,
      });
      expect(error?.code).toBe("23503");
    });
  });

  describe("invariant 5: operators", () => {
    it("an operator reads units but cannot create, change or delete them", async () => {
      const read = await operatorA.client.from("units").select("id").eq("id", unitA);
      expect(read.data).toHaveLength(1);
      expect((await newUnit(operatorA.client, orgA, propA)).error).not.toBeNull();
      const update = await operatorA.client.from("units").update({ max_guests: 9 }).eq("id", unitA).select();
      expect(update.data ?? []).toHaveLength(0);
      const del = await operatorA.client.from("units").delete().eq("id", unitA).select();
      expect(del.data ?? []).toHaveLength(0);
      const prop = await operatorA.client.from("properties").update({ name: "X" }).eq("id", propA).select();
      expect(prop.data ?? []).toHaveLength(0);
    });
  });

  describe("invariant 6: suspended organization", () => {
    it("keeps reading but cannot write accommodations", async () => {
      const owner = await newUser("accsusp");
      const org = await newOrg(owner, "accsusp");
      const { data: prop } = await newProperty(owner.client, org, true);
      expect((await superadmin.client.rpc("suspend_subscription", { p_org: org })).error).toBeNull();

      const read = await owner.client.from("properties").select("id").eq("id", prop!.id);
      expect(read.data).toHaveLength(1);
      expect((await newUnit(owner.client, org, prop!.id)).error).not.toBeNull();
      const update = await owner.client.from("properties").update({ name: "Nuevo" }).eq("id", prop!.id).select();
      expect(update.data ?? []).toHaveLength(0);

      // The public no longer sees it.
      const anon = await anonClient().from("properties").select("id").eq("id", prop!.id);
      expect(anon.data ?? []).toHaveLength(0);
    });
  });

  describe("public visibility (anon)", () => {
    it("sees published properties and units of active organizations only", async () => {
      const owner = await newUser("accpub");
      const org = await newOrg(owner, "accpub");
      const { data: published } = await newProperty(owner.client, org, true);
      const { data: draft } = await newProperty(owner.client, org, false);
      const { data: shown } = await newUnit(owner.client, org, published!.id, { is_published: true });
      const { data: hidden } = await newUnit(owner.client, org, published!.id, { name: "Oculta" });
      const { data: inDraft } = await newUnit(owner.client, org, draft!.id, { is_published: true });

      const anon = anonClient();
      const props = await anon.from("properties").select("id").in("id", [published!.id, draft!.id]);
      expect(props.data!.map((p) => p.id)).toEqual([published!.id]);
      const units = await anon.from("units").select("id").in("id", [shown!.id, hidden!.id, inDraft!.id]);
      expect(units.data!.map((u) => u.id)).toEqual([shown!.id]);
      const categories = await anon.from("unit_categories").select("id").eq("org_id", org);
      expect(categories.data ?? []).toHaveLength(0);
    });

    it("anyone can read the amenities catalog, only the platform admin edits it", async () => {
      const { data } = await anonClient().from("amenities").select("code").eq("code", "wifi");
      expect(data).toEqual([{ code: "wifi" }]);
      const insert = await ownerA.client.from("amenities").insert({ code: `x_${randomBytes(3).toString("hex")}`, name: "Xx" });
      expect(insert.error).not.toBeNull();
    });

    it("platform admin changes to the catalog are audited", async () => {
      const code = `t_${randomBytes(4).toString("hex")}`;
      const { data, error } = await superadmin.client.from("amenities").insert({ code, name: "Prueba" }).select("id").single();
      expect(error).toBeNull();
      const { data: audit } = await admin
        .from("audit_log")
        .select("action, actor_id")
        .eq("table_name", "amenities")
        .eq("record_id", data!.id);
      expect(audit).toEqual([{ action: "insert", actor_id: superadmin.id }]);
      await admin.from("audit_log").delete().eq("record_id", data!.id);
      await admin.from("amenities").delete().eq("id", data!.id);
    });
  });

  describe("unit amenities", () => {
    it("the owner sets amenities on a unit; another organization cannot", async () => {
      const { data: wifi } = await admin.from("amenities").select("id").eq("code", "wifi").single();
      const own = await ownerA.client.from("unit_amenities").insert({ org_id: orgA, unit_id: unitA, amenity_id: wifi!.id });
      expect(own.error).toBeNull();
      const foreign = await ownerB.client.from("unit_amenities").insert({ org_id: orgB, unit_id: unitA, amenity_id: wifi!.id });
      expect(foreign.error).not.toBeNull();
      const op = await operatorA.client.from("unit_amenities").delete().eq("unit_id", unitA).select();
      expect(op.data ?? []).toHaveLength(0);
    });
  });

  describe("plan unit cap", () => {
    it("refuses units beyond the plan's max_units, also under concurrent inserts", async () => {
      const { data: plan } = await superadmin.client
        .from("plans")
        .insert({ name: `Plan units ${randomBytes(4).toString("hex")}`, price_cents: 100, max_units: 2 })
        .select("id")
        .single();
      planIds.push(plan!.id);
      const owner = await newUser("acccap");
      const org = await newOrg(owner, "acccap", plan!.id);
      const { data: prop } = await newProperty(owner.client, org);

      const results = await Promise.all([1, 2, 3, 4].map((i) => newUnit(owner.client, org, prop!.id, { name: `U${i}` })));
      expect(results.filter((r) => r.error === null)).toHaveLength(2);
      const refused = results.find((r) => r.error)?.error;
      expect(refused?.message).toMatch(/unit limit reached/);
      // A stable code of its own, so the app never matches the message text.
      expect(refused?.code).toBe("RT001");
      const { count } = await admin.from("units").select("id", { count: "exact", head: true }).eq("org_id", org);
      expect(count).toBe(2);
    });
  });

  describe("time zone", () => {
    it("accepts an IANA zone and refuses anything else, on insert and update", async () => {
      const { data: prop } = await newProperty(ownerA.client, orgA);
      const ok = await ownerA.client.from("properties").update({ timezone: "America/Argentina/Cordoba" }).eq("id", prop!.id).select("timezone");
      expect(ok.error).toBeNull();
      expect(ok.data).toEqual([{ timezone: "America/Argentina/Cordoba" }]);

      const bad = await ownerA.client.from("properties").update({ timezone: "Marte/Olimpo" }).eq("id", prop!.id).select();
      expect(bad.error?.code).toBe("RT002");
      const { data: row } = await admin.from("properties").select("timezone").eq("id", prop!.id).single();
      expect(row!.timezone).toBe("America/Argentina/Cordoba");

      const insert = await ownerA.client
        .from("properties")
        .insert({ org_id: orgA, slug: uniqueSlug("tz"), name: "Zona mala", timezone: "GMT+99" })
        .select();
      expect(insert.error?.code).toBe("RT002");
    });

    it("refuses entries of pg_timezone_names that are not IANA zones the app can format", async () => {
      const { data: prop } = await newProperty(ownerA.client, orgA);
      for (const timezone of ["Factory", "posixrules", "posix/America/Cordoba", "right/UTC", "localtime"]) {
        const bad = await ownerA.client.from("properties").update({ timezone }).eq("id", prop!.id).select();
        expect(bad.error?.code, timezone).toBe("RT002");
      }
      for (const timezone of ["UTC", "Etc/GMT+3", "America/Argentina/Buenos_Aires"]) {
        const ok = await ownerA.client.from("properties").update({ timezone }).eq("id", prop!.id).select("timezone");
        expect(ok.error, timezone).toBeNull();
        // The same value must be usable by Intl in the panel and the public page.
        expect(() => new Intl.DateTimeFormat("es-AR", { timeZone: timezone })).not.toThrow();
      }
    });
  });

  describe("photo order", () => {
    it("numbers photos of a property in arrival order, also under concurrent inserts", async () => {
      const { data: prop } = await newProperty(ownerA.client, orgA);
      const results = await Promise.all(
        [1, 2, 3, 4].map((i) =>
          // The sort sent by the client is ignored: the database assigns the next one.
          ownerA.client.from("media").insert({ org_id: orgA, property_id: prop!.id, storage_path: `${orgA}/${prop!.id}/p${i}.jpg`, sort: 0 }),
        ),
      );
      expect(results.map((r) => r.error)).toEqual([null, null, null, null]);
      const { data } = await admin.from("media").select("sort").eq("property_id", prop!.id).order("sort");
      expect(data!.map((m) => m.sort)).toEqual([0, 1, 2, 3]);
    });
  });

  describe("storage", () => {
    it("the owner uploads under their organization and property; others cannot", async () => {
      const own = `${orgA}/${propA}/${randomBytes(6).toString("hex")}.jpg`;
      const up = await ownerA.client.storage.from("media").upload(own, jpeg, { contentType: "image/jpeg" });
      expect(up.error).toBeNull();
      objects.push(own);

      const media = await ownerA.client.from("media").insert({ org_id: orgA, property_id: propA, storage_path: own }).select("id");
      expect(media.error).toBeNull();

      // B writing into A's folder, into a mismatched org/property pair, or an operator: refused.
      const intoA = await ownerB.client.storage
        .from("media")
        .upload(`${orgA}/${propA}/${randomBytes(6).toString("hex")}.jpg`, jpeg, { contentType: "image/jpeg" });
      expect(intoA.error).not.toBeNull();
      const mismatched = await ownerB.client.storage
        .from("media")
        .upload(`${orgB}/${propA}/${randomBytes(6).toString("hex")}.jpg`, jpeg, { contentType: "image/jpeg" });
      expect(mismatched.error).not.toBeNull();
      const byOperator = await operatorA.client.storage
        .from("media")
        .upload(`${orgA}/${propA}/${randomBytes(6).toString("hex")}.jpg`, jpeg, { contentType: "image/jpeg" });
      expect(byOperator.error).not.toBeNull();

      const wrongPath = await ownerA.client
        .from("media")
        .insert({ org_id: orgA, property_id: propA, storage_path: `${orgB}/${propB}/x.jpg` });
      expect(wrongPath.error).not.toBeNull();
    });

    it("rejects other content types", async () => {
      const path = `${orgA}/${propA}/${randomBytes(6).toString("hex")}.svg`;
      const { error } = await ownerA.client.storage
        .from("media")
        .upload(path, new Blob(["<svg/>"], { type: "image/svg+xml" }), { contentType: "image/svg+xml" });
      expect(error).not.toBeNull();
    });
  });
});
