import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { adminClient, anonClient, assertDbEnv, createTestUser, uniqueSlug, type TestUser } from "./helpers";

// Phase 6: what anonymous visitors can read for the public page. Invariant 7 (no guests, bookings or
// payments; availability without personal data) and invariant 6 (suspended = "no disponible").
assertDbEnv();
const skipDb = process.env.SKIP_DB_TESTS === "1";

describe.skipIf(skipDb)("public page (Phase 6)", () => {
  let admin: SupabaseClient;
  const users: TestUser[] = [];
  const orgIds: string[] = [];
  let superadmin: TestUser;
  let owner: TestUser;
  let org: string;
  let slug: string;
  let draftSlug: string;
  let propertyId: string;
  let draftId: string;
  let shownUnit: string;
  let hiddenUnit: string;
  let categoryId: string;

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

  async function newProperty(by: TestUser, inOrg: string, published: boolean, extra: Record<string, unknown> = {}) {
    const s = uniqueSlug("pub");
    const { data, error } = await by.client
      .from("properties")
      .insert({ org_id: inOrg, slug: s, name: "Cabañas del Arroyo", is_published: published, ...extra })
      .select("id")
      .single();
    expect(error).toBeNull();
    return { id: data!.id as string, slug: s };
  }

  async function newUnit(by: TestUser, inOrg: string, property: string, values: Record<string, unknown> = {}) {
    const { data, error } = await by.client
      .from("units")
      .insert({ org_id: inOrg, property_id: property, kind: "cabin", name: uniqueSlug("u"), max_guests: 4, ...values })
      .select("id")
      .single();
    expect(error).toBeNull();
    return data!.id as string;
  }

  async function book(unit: string, from: string, to: string, status: "confirmed" | "provisional" = "confirmed") {
    const { data, error } = await owner.client.rpc("create_booking", {
      p_unit: unit,
      p_check_in: from,
      p_check_out: to,
      p_kind: "booking",
      p_status: status,
      p_guests_count: 2,
      p_guest_name: "Ana Pérez",
      p_guest_phone: "3544000000",
    });
    expect(error).toBeNull();
    return data as string;
  }

  beforeAll(async () => {
    admin = adminClient();
    [superadmin, owner] = await Promise.all([newUser("pubsuper"), newUser("pubowner")]);
    await admin.from("platform_admins").insert({ user_id: superadmin.id });
    org = await newOrg(owner, "pub");

    // One day of cleaning after each stay: it extends the occupied range.
    ({ id: propertyId, slug } = await newProperty(owner, org, true, { cleaning_buffer_days: 1 }));
    ({ id: draftId, slug: draftSlug } = await newProperty(owner, org, false));
    const category = await owner.client
      .from("unit_categories")
      .insert({ org_id: org, property_id: propertyId, name: "Cabañas dobles" })
      .select("id")
      .single();
    expect(category.error).toBeNull();
    categoryId = category.data!.id;
    shownUnit = await newUnit(owner, org, propertyId, { is_published: true, category_id: categoryId });
    hiddenUnit = await newUnit(owner, org, propertyId, { is_published: false });

    await book(shownUnit, "2041-03-10", "2041-03-13");
    await book(hiddenUnit, "2041-03-01", "2041-03-05");
    const cancelled = await book(shownUnit, "2041-03-20", "2041-03-22");
    expect((await owner.client.from("bookings").update({ status: "cancelled" }).eq("id", cancelled)).error).toBeNull();
  });

  afterAll(async () => {
    for (const id of orgIds) await admin.from("audit_log").delete().eq("org_id", id);
    for (const id of orgIds) await admin.from("organizations").delete().eq("id", id);
    for (const user of users) await admin.auth.admin.deleteUser(user.id);
  });

  describe("public_availability", () => {
    it("returns only the occupied ranges of published units, cleaning days included, without personal data", async () => {
      const { data, error } = await anonClient().rpc("public_availability", { p_slug: slug, p_from: "2041-03-01", p_to: "2041-04-01" });
      expect(error).toBeNull();
      // The hidden unit and the cancelled stay are left out; 10→13 plus one cleaning day ends on the 14th.
      expect(data).toEqual([{ unit_id: shownUnit, starts_on: "2041-03-10", ends_on: "2041-03-14" }]);
    });

    it("only returns ranges that overlap the requested window", async () => {
      const { data } = await anonClient().rpc("public_availability", { p_slug: slug, p_from: "2041-03-14", p_to: "2041-03-20" });
      expect(data).toEqual([]);
    });

    it("returns nothing for an unpublished property or an unknown slug", async () => {
      for (const s of [draftSlug, "no-existe-este-slug"]) {
        const { data, error } = await anonClient().rpc("public_availability", { p_slug: s, p_from: "2041-03-01", p_to: "2041-04-01" });
        expect(error).toBeNull();
        expect(data).toEqual([]);
      }
    });

    it("rejects an inverted or too long window", async () => {
      const inverted = await anonClient().rpc("public_availability", { p_slug: slug, p_from: "2041-04-01", p_to: "2041-03-01" });
      expect(inverted.error).not.toBeNull();
      const long = await anonClient().rpc("public_availability", { p_slug: slug, p_from: "2041-01-01", p_to: "2043-06-01" });
      expect(long.error).not.toBeNull();
    });
  });

  describe("invariant 7: anon never reads guests, bookings or payments", () => {
    it("gets nothing from those tables", async () => {
      const anon = anonClient();
      for (const table of ["bookings", "guests", "booking_payments"] as const) {
        const { data } = await anon.from(table).select("id").limit(1);
        expect(data ?? []).toHaveLength(0);
      }
    });
  });

  describe("pricing data of published properties", () => {
    it("anon reads rates, discounts, categories and amenities of a published property, not of a draft", async () => {
      const rate = (property: string, unit: string | null) => ({
        org_id: org,
        property_id: property,
        unit_id: unit,
        kind: "base",
        name: "Base",
        price_cents: 1_000_000,
      });
      const draftUnit = await newUnit(owner, org, draftId, { is_published: true });
      expect((await owner.client.from("rate_rules").insert([rate(propertyId, shownUnit), rate(draftId, draftUnit)])).error).toBeNull();
      expect(
        (
          await owner.client.from("length_discounts").insert([
            { org_id: org, property_id: propertyId, min_nights: 7, pct: 10 },
            { org_id: org, property_id: draftId, min_nights: 7, pct: 10 },
          ])
        ).error,
      ).toBeNull();
      const { data: wifi } = await admin.from("amenities").select("id").eq("code", "wifi").single();
      expect(
        (
          await owner.client.from("unit_amenities").insert([
            { org_id: org, unit_id: shownUnit, amenity_id: wifi!.id },
            { org_id: org, unit_id: draftUnit, amenity_id: wifi!.id },
          ])
        ).error,
      ).toBeNull();

      const anon = anonClient();
      const rules = await anon.from("rate_rules").select("property_id").eq("org_id", org);
      expect(rules.data).toEqual([{ property_id: propertyId }]);
      const discounts = await anon.from("length_discounts").select("property_id").eq("org_id", org);
      expect(discounts.data).toEqual([{ property_id: propertyId }]);
      const categories = await anon.from("unit_categories").select("id").eq("org_id", org);
      expect(categories.data).toEqual([{ id: categoryId }]);
      const amenities = await anon.from("unit_amenities").select("unit_id").eq("org_id", org);
      expect(amenities.data).toEqual([{ unit_id: shownUnit }]);
      const holidays = await anon.from("holidays").select("date").limit(1);
      expect(holidays.error).toBeNull();
    });

    it("anon still cannot write rates or holidays", async () => {
      const anon = anonClient();
      const rule = await anon.from("rate_rules").insert({ org_id: org, property_id: propertyId, unit_id: shownUnit, kind: "base", name: "X", price_cents: 1 });
      expect(rule.error).not.toBeNull();
      expect((await anon.from("holidays").insert({ date: "2041-12-31", name: "X" })).error).not.toBeNull();
    });
  });

  describe("public_property_state (invariant 6)", () => {
    it("tells a published page from a suspended one, and hides drafts", async () => {
      const anon = anonClient();
      expect((await anon.rpc("public_property_state", { p_slug: slug })).data).toBe("published");
      expect((await anon.rpc("public_property_state", { p_slug: draftSlug })).data).toBe("missing");
      expect((await anon.rpc("public_property_state", { p_slug: "no-existe-este-slug" })).data).toBe("missing");

      const other = await newUser("pubsusp");
      const suspendedOrg = await newOrg(other, "pubsusp");
      const suspended = await newProperty(other, suspendedOrg, true);
      const unit = await newUnit(other, suspendedOrg, suspended.id, { is_published: true });
      expect(unit).toBeTruthy();
      expect((await superadmin.client.rpc("suspend_subscription", { p_org: suspendedOrg })).error).toBeNull();

      expect((await anon.rpc("public_property_state", { p_slug: suspended.slug })).data).toBe("unavailable");
      const availability = await anon.rpc("public_availability", { p_slug: suspended.slug, p_from: "2041-03-01", p_to: "2041-04-01" });
      expect(availability.data).toEqual([]);
      const rows = await anon.from("properties").select("id").eq("id", suspended.id);
      expect(rows.data ?? []).toHaveLength(0);
    });
  });
});
