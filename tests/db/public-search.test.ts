import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { adminClient, anonClient, assertDbEnv, createTestUser, uniqueSlug, type TestUser } from "./helpers";

// Phase 6, search (D26): public_search finds published properties of active accounts by place or name
// (accent-insensitive) and, given dates, only those with a free unit for the guests. No personal data.
assertDbEnv();
const skipDb = process.env.SKIP_DB_TESTS === "1";

type Row = { slug: string; name: string; city: string | null; province: string | null; free_units: number };

describe.skipIf(skipDb)("public search (Phase 6)", () => {
  let admin: SupabaseClient;
  const users: TestUser[] = [];
  const orgIds: string[] = [];
  let superadmin: TestUser;
  let owner: TestUser;
  let org: string;
  // A unique word in every name keeps other data in the dev project out of the results.
  const tag = `zq${Math.random().toString(36).slice(2, 8)}`;
  let rio: string;
  let alamos: string;
  let draft: string;

  async function newUser(label: string) {
    const user = await createTestUser(admin, label);
    users.push(user);
    return user;
  }

  async function newOrg(by: TestUser, label: string) {
    const { data, error } = await by.client.rpc("register_organization", { p_name: `Org ${label}`, p_slug: uniqueSlug(label) });
    expect(error).toBeNull();
    orgIds.push(data as string);
    expect((await superadmin.client.rpc("review_organization", { p_org: data, p_approve: true })).error).toBeNull();
    return data as string;
  }

  async function newProperty(by: TestUser, inOrg: string, values: Record<string, unknown>) {
    const slug = uniqueSlug("bus");
    const { data, error } = await by.client
      .from("properties")
      .insert({ org_id: inOrg, slug, is_published: true, ...values })
      .select("id")
      .single();
    expect(error).toBeNull();
    return { id: data!.id as string, slug };
  }

  async function newUnit(by: TestUser, inOrg: string, property: string, maxGuests: number) {
    const { data, error } = await by.client
      .from("units")
      .insert({ org_id: inOrg, property_id: property, kind: "cabin", name: uniqueSlug("u"), max_guests: maxGuests, is_published: true })
      .select("id")
      .single();
    expect(error).toBeNull();
    return data!.id as string;
  }

  const search = (args: { p_query?: string; p_check_in?: string; p_check_out?: string; p_guests?: number }) =>
    anonClient().rpc("public_search", { p_query: tag, ...args });

  beforeAll(async () => {
    admin = adminClient();
    [superadmin, owner] = await Promise.all([newUser("bussuper"), newUser("busowner")]);
    await admin.from("platform_admins").insert({ user_id: superadmin.id });
    org = await newOrg(owner, "bus");

    const a = await newProperty(owner, org, { name: `Cabañas del Río ${tag}`, city: "Mina Clavero", province: "Córdoba", cleaning_buffer_days: 1 });
    const b = await newProperty(owner, org, { name: `Hostería Los Álamos ${tag}`, city: "Nono", province: "Córdoba" });
    const c = await newProperty(owner, org, { name: `Borrador ${tag}`, city: "Nono", is_published: false });
    rio = a.slug;
    alamos = b.slug;
    draft = c.slug;

    const rioUnit = await newUnit(owner, org, a.id, 4);
    await newUnit(owner, org, b.id, 2);
    await newUnit(owner, org, b.id, 6);
    await newUnit(owner, org, c.id, 4);

    // The Río's only cabin is taken 10 → 13 (plus one cleaning day).
    const booked = await owner.client.rpc("create_booking", {
      p_unit: rioUnit,
      p_check_in: "2041-08-10",
      p_check_out: "2041-08-13",
      p_kind: "booking",
      p_status: "confirmed",
      p_guests_count: 2,
      p_guest_name: "Ana Pérez",
    });
    expect(booked.error).toBeNull();
  });

  afterAll(async () => {
    for (const id of orgIds) await admin.from("audit_log").delete().eq("org_id", id);
    for (const id of orgIds) await admin.from("organizations").delete().eq("id", id);
    for (const user of users) await admin.auth.admin.deleteUser(user.id);
  });

  it("lists published properties by name, without drafts, with place and unit count only", async () => {
    const { data, error } = await search({});
    expect(error).toBeNull();
    expect(data!.map((r: Row) => r.slug).sort()).toEqual([rio, alamos].sort());
    expect(data!.find((r: Row) => r.slug === alamos)).toEqual({
      slug: alamos,
      name: `Hostería Los Álamos ${tag}`,
      city: "Nono",
      province: "Córdoba",
      free_units: 2,
    });
    expect(data!.map((r: Row) => r.slug)).not.toContain(draft);
  });

  it("matches every word, ignoring accents and case, in the name or the place", async () => {
    const byPlace = await search({ p_query: `${tag} MINA clavero` });
    expect(byPlace.data!.map((r: Row) => r.slug)).toEqual([rio]);
    const unaccented = await search({ p_query: `alamos ${tag}` });
    expect(unaccented.data!.map((r: Row) => r.slug)).toEqual([alamos]);
    const noMatch = await search({ p_query: `${tag} villa dolores` });
    expect(noMatch.data).toEqual([]);
  });

  it("with dates, keeps only properties with a free unit, cleaning days included", async () => {
    const taken = await search({ p_check_in: "2041-08-11", p_check_out: "2041-08-12", p_guests: 2 });
    expect(taken.data!.map((r: Row) => r.slug)).toEqual([alamos]);
    // Leaving on the 13th plus one cleaning day: arriving on the 14th is free, on the 13th is not.
    const after = await search({ p_check_in: "2041-08-14", p_check_out: "2041-08-16", p_guests: 2 });
    expect(after.data!.map((r: Row) => r.slug).sort()).toEqual([rio, alamos].sort());
    const before = await search({ p_check_in: "2041-08-08", p_check_out: "2041-08-10", p_guests: 2 });
    expect(before.data!.map((r: Row) => r.slug)).toEqual([alamos]);
  });

  it("counts only units that hold the guests", async () => {
    const { data } = await search({ p_check_in: "2041-08-20", p_check_out: "2041-08-22", p_guests: 5 });
    expect(data).toEqual([expect.objectContaining({ slug: alamos, free_units: 1 })]);
    const none = await search({ p_guests: 7 });
    expect(none.data).toEqual([]);
  });

  it("rejects half a date range, inverted dates, too long stays and bad guest counts", async () => {
    expect((await search({ p_check_in: "2041-08-20" })).error).not.toBeNull();
    expect((await search({ p_check_in: "2041-08-22", p_check_out: "2041-08-20" })).error).not.toBeNull();
    expect((await search({ p_check_in: "2041-01-01", p_check_out: "2042-01-03" })).error).not.toBeNull();
    expect((await search({ p_guests: 0 })).error).not.toBeNull();
    expect((await search({ p_query: "x".repeat(81) })).error).not.toBeNull();
  });

  it("hides the properties of a suspended account", async () => {
    expect((await superadmin.client.rpc("suspend_subscription", { p_org: org })).error).toBeNull();
    const { data } = await search({});
    expect(data).toEqual([]);
  });

  it("'buscar' is reserved: no property or organization can take /buscar", async () => {
    // The admin client skips RLS, so only the CHECK constraint can stop these.
    const property = await admin.from("properties").insert({ org_id: org, slug: "buscar", name: "Choca" });
    expect(property.error?.code).toBe("23514");
    const organization = await admin.from("organizations").insert({ name: "Choca", slug: "buscar" });
    expect(organization.error?.code).toBe("23514");
  });
});
