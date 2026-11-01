import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { adminClient, anonClient, assertDbEnv, createTestUser, newToken, uniqueSlug, type TestUser } from "./helpers";

// Phase 4: booking engine. Invariants 1 (no overlap under real concurrency), 2 (an expired
// provisional never blocks, even before pg_cron runs) and 3 (cleaning buffer), plus states,
// capacity, category assignment and the RLS invariants 4, 6 and 7 on the new tables.
assertDbEnv();
const skipDb = process.env.SKIP_DB_TESTS === "1";

const OVERLAP = "23P01";

describe.skipIf(skipDb)("bookings (Phase 4)", () => {
  let admin: SupabaseClient;
  const users: TestUser[] = [];
  const orgIds: string[] = [];

  let superadmin: TestUser;
  let ownerA: TestUser;
  let operatorA: TestUser;
  let ownerB: TestUser;
  let orgA: string;
  let orgB: string;
  let propA: string;

  async function newUser(label: string) {
    const user = await createTestUser(admin, label);
    users.push(user);
    return user;
  }

  async function newOrg(owner: TestUser, label: string) {
    const { data, error } = await owner.client.rpc("register_organization", { p_name: `Org ${label}`, p_slug: uniqueSlug(label) });
    expect(error).toBeNull();
    orgIds.push(data as string);
    expect((await superadmin.client.rpc("review_organization", { p_org: data, p_approve: true })).error).toBeNull();
    return data as string;
  }

  async function newProperty(client: SupabaseClient, org: string, values: Record<string, unknown> = {}) {
    const { data, error } = await client
      .from("properties")
      .insert({ org_id: org, slug: uniqueSlug("bk"), name: "Cabañas", ...values })
      .select("id")
      .single();
    expect(error).toBeNull();
    return data!.id as string;
  }

  async function newUnit(client: SupabaseClient, org: string, property: string, values: Record<string, unknown> = {}) {
    const { data, error } = await client
      .from("units")
      .insert({ org_id: org, property_id: property, kind: "cabin", name: uniqueSlug("u"), max_guests: 4, ...values })
      .select("id")
      .single();
    expect(error).toBeNull();
    return data!.id as string;
  }

  type BookingArgs = {
    unit: string;
    from: string;
    to: string;
    status?: "provisional" | "confirmed";
    kind?: "booking" | "block";
    guests?: number | null;
    name?: string;
  };

  function book(client: SupabaseClient, a: BookingArgs) {
    const kind = a.kind ?? "booking";
    return client.rpc("create_booking", {
      p_unit: a.unit,
      p_check_in: a.from,
      p_check_out: a.to,
      p_kind: kind,
      p_status: a.status ?? "confirmed",
      p_guests_count: kind === "block" ? null : (a.guests ?? 2),
      p_guest_name: kind === "block" ? null : (a.name ?? "Ana Pérez"),
      p_guest_phone: kind === "block" ? null : "5493515550000",
    });
  }

  async function status(id: string) {
    const { data } = await admin.from("bookings").select("status").eq("id", id).single();
    return data?.status as string | undefined;
  }

  beforeAll(async () => {
    admin = adminClient();
    [superadmin, ownerA, operatorA, ownerB] = await Promise.all([
      newUser("bksuper"),
      newUser("bkownera"),
      newUser("bkopa"),
      newUser("bkownerb"),
    ]);
    await admin.from("platform_admins").insert({ user_id: superadmin.id });
    orgA = await newOrg(ownerA, "bka");
    orgB = await newOrg(ownerB, "bkb");

    const { token, hash } = newToken();
    await ownerA.client.from("invitations").insert({ org_id: orgA, role: "operator", token_hash: hash, created_by: ownerA.id });
    expect((await operatorA.client.rpc("accept_invitation", { p_token: token })).error).toBeNull();

    propA = await newProperty(ownerA.client, orgA);
  });

  afterAll(async () => {
    if (orgIds.length) {
      await admin.from("audit_log").delete().in("org_id", orgIds);
      await admin.from("organizations").delete().in("id", orgIds);
    }
    for (const user of users) await admin.auth.admin.deleteUser(user.id);
  });

  describe("invariant 1: no overlap, also under real concurrency", () => {
    it("of five concurrent overlapping bookings for one unit, exactly one is stored", async () => {
      const unit = await newUnit(ownerA.client, orgA, propA);
      // Separate sessions and staggered ranges that all share the night of the 12th.
      const results = await Promise.all([
        book(ownerA.client, { unit, from: "2030-01-10", to: "2030-01-13" }),
        book(operatorA.client, { unit, from: "2030-01-11", to: "2030-01-14" }),
        book(ownerA.client, { unit, from: "2030-01-12", to: "2030-01-13" }),
        book(operatorA.client, { unit, from: "2030-01-09", to: "2030-01-15", status: "provisional" }),
        book(ownerA.client, { unit, from: "2030-01-12", to: "2030-01-16", kind: "block" }),
      ]);
      expect(results.filter((r) => r.error === null)).toHaveLength(1);
      for (const r of results.filter((r) => r.error)) expect(r.error?.code).toBe(OVERLAP);
      const { count } = await admin.from("bookings").select("id", { count: "exact", head: true }).eq("unit_id", unit);
      expect(count).toBe(1);
    });

    it("a block blocks like a booking, and adjacent stays fit", async () => {
      const unit = await newUnit(ownerA.client, orgA, propA);
      expect((await book(ownerA.client, { unit, from: "2030-02-10", to: "2030-02-15", kind: "block" })).error).toBeNull();
      expect((await book(ownerA.client, { unit, from: "2030-02-14", to: "2030-02-16" })).error?.code).toBe(OVERLAP);
      // Check-out day is free: 15 → 17 starts when the block ends.
      expect((await book(ownerA.client, { unit, from: "2030-02-15", to: "2030-02-17" })).error).toBeNull();
      expect((await book(ownerA.client, { unit, from: "2030-02-08", to: "2030-02-10" })).error).toBeNull();
    });
  });

  describe("invariant 2: an expired provisional does not block", () => {
    it("is expired by the next booking of that unit even if pg_cron has not run", async () => {
      const unit = await newUnit(ownerA.client, orgA, propA);
      const first = await book(ownerA.client, { unit, from: "2030-03-10", to: "2030-03-13", status: "provisional" });
      expect(first.error).toBeNull();
      // While valid it blocks.
      expect((await book(ownerA.client, { unit, from: "2030-03-11", to: "2030-03-12" })).error?.code).toBe(OVERLAP);

      // Its hold ran out a minute ago; the cron job has not run.
      await admin.from("bookings").update({ expires_at: new Date(Date.now() - 60_000).toISOString() }).eq("id", first.data);
      const second = await book(ownerA.client, { unit, from: "2030-03-11", to: "2030-03-12" });
      expect(second.error).toBeNull();
      expect(await status(first.data as string)).toBe("expired");
    });

    it("cannot be confirmed once its hold ran out", async () => {
      const unit = await newUnit(ownerA.client, orgA, propA);
      const { data: id } = await book(ownerA.client, { unit, from: "2030-03-20", to: "2030-03-22", status: "provisional" });
      await admin.from("bookings").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("id", id);
      const { error } = await ownerA.client.from("bookings").update({ status: "confirmed" }).eq("id", id).select();
      expect(error?.message).toContain("provisional_expired");
    });

    it("gets expires_at from the property's hold hours", async () => {
      const prop = await newProperty(ownerA.client, orgA, { provisional_hold_hours: 6 });
      const unit = await newUnit(ownerA.client, orgA, prop);
      const before = Date.now();
      const { data: id } = await book(ownerA.client, { unit, from: "2030-03-25", to: "2030-03-27", status: "provisional" });
      const { data } = await admin.from("bookings").select("expires_at").eq("id", id).single();
      const hours = (new Date(data!.expires_at).getTime() - before) / 3_600_000;
      expect(hours).toBeGreaterThan(5.9);
      expect(hours).toBeLessThan(6.1);
    });

    it("the scheduled job expires stale provisionals; members cannot run it", async () => {
      const unit = await newUnit(ownerA.client, orgA, propA);
      const { data: id } = await book(ownerA.client, { unit, from: "2030-04-01", to: "2030-04-03", status: "provisional" });
      await admin.from("bookings").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("id", id);

      expect((await ownerA.client.rpc("expire_provisional_bookings")).error).not.toBeNull();
      const run = await admin.rpc("expire_provisional_bookings");
      expect(run.error).toBeNull();
      expect(run.data).toBeGreaterThanOrEqual(1);
      expect(await status(id as string)).toBe("expired");
      // The pg_cron schedule (*/5) is checked against cron.job after the migration; that schema is not exposed over REST.
    });
  });

  describe("invariant 3: cleaning buffer", () => {
    it("allows same-day turnover with buffer 0", async () => {
      const unit = await newUnit(ownerA.client, orgA, propA);
      expect((await book(ownerA.client, { unit, from: "2030-05-10", to: "2030-05-13" })).error).toBeNull();
      expect((await book(ownerA.client, { unit, from: "2030-05-13", to: "2030-05-15" })).error).toBeNull();
    });

    it("rejects it with buffer 1 and allows the day after", async () => {
      const prop = await newProperty(ownerA.client, orgA, { cleaning_buffer_days: 1 });
      const unit = await newUnit(ownerA.client, orgA, prop);
      expect((await book(ownerA.client, { unit, from: "2030-05-10", to: "2030-05-13" })).error).toBeNull();
      expect((await book(ownerA.client, { unit, from: "2030-05-13", to: "2030-05-15" })).error?.code).toBe(OVERLAP);
      expect((await book(ownerA.client, { unit, from: "2030-05-14", to: "2030-05-16" })).error).toBeNull();
    });

    it("copies the buffer at creation: the client value is ignored and later changes do not apply", async () => {
      const prop = await newProperty(ownerA.client, orgA, { cleaning_buffer_days: 2 });
      const unit = await newUnit(ownerA.client, orgA, prop);
      const { data: guest } = await ownerA.client.from("guests").insert({ org_id: orgA, full_name: "Directo" }).select("id").single();
      const { data, error } = await ownerA.client
        .from("bookings")
        .insert({
          org_id: orgA,
          property_id: prop,
          unit_id: unit,
          guest_id: guest!.id,
          kind: "booking",
          status: "confirmed",
          check_in: "2030-06-01",
          check_out: "2030-06-03",
          guests_count: 2,
          cleaning_buffer_days: 0,
        })
        .select("cleaning_buffer_days")
        .single();
      expect(error).toBeNull();
      expect(data!.cleaning_buffer_days).toBe(2);

      await ownerA.client.from("properties").update({ cleaning_buffer_days: 0 }).eq("id", prop);
      // Still blocked through the 4th: the stored buffer did not change.
      expect((await book(ownerA.client, { unit, from: "2030-06-04", to: "2030-06-05" })).error?.code).toBe(OVERLAP);
      expect((await book(ownerA.client, { unit, from: "2030-06-05", to: "2030-06-06" })).error).toBeNull();
    });
  });

  describe("states", () => {
    it("follows provisional → confirmed → checked_in → checked_out and refuses going back", async () => {
      const unit = await newUnit(ownerA.client, orgA, propA);
      const { data: id } = await book(operatorA.client, { unit, from: "2030-07-01", to: "2030-07-03", status: "provisional" });
      for (const next of ["confirmed", "checked_in", "checked_out"]) {
        const { error } = await operatorA.client.from("bookings").update({ status: next }).eq("id", id).select();
        expect(error, next).toBeNull();
      }
      const { data: row } = await admin.from("bookings").select("expires_at").eq("id", id).single();
      expect(row!.expires_at).toBeNull();
      const back = await operatorA.client.from("bookings").update({ status: "confirmed" }).eq("id", id).select();
      expect(back.error?.message).toContain("invalid_transition");
    });

    it("a cancelled booking frees its dates", async () => {
      const unit = await newUnit(ownerA.client, orgA, propA);
      const { data: id } = await book(ownerA.client, { unit, from: "2030-07-10", to: "2030-07-12" });
      expect((await ownerA.client.from("bookings").update({ status: "cancelled" }).eq("id", id).select()).error).toBeNull();
      expect((await book(ownerA.client, { unit, from: "2030-07-10", to: "2030-07-12" })).error).toBeNull();
    });

    it("refuses invalid dates, statuses and changes to fixed fields", async () => {
      const unit = await newUnit(ownerA.client, orgA, propA);
      expect((await book(ownerA.client, { unit, from: "2030-07-20", to: "2030-07-20" })).error).not.toBeNull();
      const created = await ownerA.client.rpc("create_booking", {
        p_unit: unit,
        p_check_in: "2030-07-20",
        p_check_out: "2030-07-22",
        p_status: "checked_in",
        p_guests_count: 2,
        p_guest_name: "X",
      });
      expect(created.error?.message).toContain("invalid_status");
      const { data: id } = await book(ownerA.client, { unit, from: "2030-07-20", to: "2030-07-22" });
      const kind = await ownerA.client.from("bookings").update({ kind: "block" }).eq("id", id).select();
      expect(kind.error?.message).toContain("immutable_field");
    });
  });

  describe("amounts", () => {
    it("members can neither send nor change price, deposit, breakdown or currency", async () => {
      const unit = await newUnit(ownerA.client, orgA, propA);
      const { data, error } = await operatorA.client
        .from("bookings")
        .insert({
          org_id: orgA,
          property_id: propA,
          unit_id: unit,
          kind: "booking",
          status: "confirmed",
          check_in: "2030-08-20",
          check_out: "2030-08-22",
          guests_count: 2,
          total_cents: 1,
          deposit_cents: 1,
          price_breakdown: { forged: true },
          currency: "USD",
        })
        .select("id, total_cents, deposit_cents, price_breakdown, currency")
        .single();
      expect(error).toBeNull();
      expect(data).toMatchObject({ total_cents: null, deposit_cents: null, price_breakdown: null, currency: "ARS" });

      for (const change of [{ total_cents: 5 }, { deposit_cents: 5 }, { price_breakdown: {} }, { currency: "USD" }]) {
        const update = await operatorA.client.from("bookings").update(change).eq("id", data!.id).select();
        expect(update.error?.message, JSON.stringify(change)).toContain("immutable_field");
      }
    });
  });

  describe("capacity and reassignment", () => {
    it("refuses more guests than the unit holds", async () => {
      const unit = await newUnit(ownerA.client, orgA, propA, { max_guests: 2 });
      const { error } = await book(ownerA.client, { unit, from: "2030-08-01", to: "2030-08-03", guests: 3 });
      expect(error?.message).toContain("capacity_exceeded");
    });

    it("moves a booking to a free unit of the property, never onto an occupied or smaller one", async () => {
      const [from, busy, small, free] = await Promise.all([
        newUnit(ownerA.client, orgA, propA),
        newUnit(ownerA.client, orgA, propA),
        newUnit(ownerA.client, orgA, propA, { max_guests: 1 }),
        newUnit(ownerA.client, orgA, propA),
      ]);
      const { data: id } = await book(ownerA.client, { unit: from, from: "2030-08-10", to: "2030-08-13", guests: 2 });
      await book(ownerA.client, { unit: busy, from: "2030-08-12", to: "2030-08-14" });

      const onBusy = await operatorA.client.from("bookings").update({ unit_id: busy }).eq("id", id).select();
      expect(onBusy.error?.code).toBe(OVERLAP);
      const onSmall = await operatorA.client.from("bookings").update({ unit_id: small }).eq("id", id).select();
      expect(onSmall.error?.message).toContain("capacity_exceeded");
      const ok = await operatorA.client.from("bookings").update({ unit_id: free, check_out: "2030-08-14" }).eq("id", id).select("unit_id");
      expect(ok.error).toBeNull();
      expect(ok.data).toEqual([{ unit_id: free }]);
    });
  });

  describe("booking by category", () => {
    it("assigns the first free unit; concurrent requests get different units until none is left", async () => {
      const { data: category } = await ownerA.client
        .from("unit_categories")
        .insert({ org_id: orgA, property_id: propA, name: uniqueSlug("Doble") })
        .select("id")
        .single();
      const first = await newUnit(ownerA.client, orgA, propA, { category_id: category!.id, sort: 1 });
      const second = await newUnit(ownerA.client, orgA, propA, { category_id: category!.id, sort: 2 });

      const request = (client: SupabaseClient) =>
        client.rpc("create_booking_for_category", {
          p_category: category!.id,
          p_check_in: "2030-09-10",
          p_check_out: "2030-09-12",
          p_guests_count: 2,
          p_guest_name: "Huésped",
        });
      const results = await Promise.all([request(ownerA.client), request(operatorA.client), request(ownerA.client)]);
      const ok = results.filter((r) => r.error === null);
      expect(ok).toHaveLength(2);
      expect(results.find((r) => r.error)?.error?.message).toContain("no_unit_available");

      const { data: rows } = await admin.from("bookings").select("unit_id").in("id", ok.map((r) => r.data as string));
      expect(new Set(rows!.map((r) => r.unit_id))).toEqual(new Set([first, second]));
    });

    it("skips units that are too small and says so when none fits", async () => {
      const { data: category } = await ownerA.client
        .from("unit_categories")
        .insert({ org_id: orgA, property_id: propA, name: uniqueSlug("Simple") })
        .select("id")
        .single();
      await newUnit(ownerA.client, orgA, propA, { category_id: category!.id, max_guests: 2 });
      const { error } = await ownerA.client.rpc("create_booking_for_category", {
        p_category: category!.id,
        p_check_in: "2030-09-20",
        p_check_out: "2030-09-21",
        p_guests_count: 3,
        p_guest_name: "Grupo",
      });
      expect(error?.message).toContain("capacity_exceeded");
    });
  });

  describe("access (invariants 4, 6 and 7)", () => {
    it("another organization neither sees nor books A's units, bookings or guests", async () => {
      const unit = await newUnit(ownerA.client, orgA, propA);
      const { data: id } = await book(ownerA.client, { unit, from: "2030-10-01", to: "2030-10-03" });
      expect((await book(ownerB.client, { unit, from: "2030-10-05", to: "2030-10-06" })).error?.message).toContain("unit_not_found");
      expect((await ownerB.client.from("bookings").select("id").eq("id", id)).data ?? []).toHaveLength(0);
      expect((await ownerB.client.from("guests").select("id").eq("org_id", orgA)).data ?? []).toHaveLength(0);
      const update = await ownerB.client.from("bookings").update({ status: "cancelled" }).eq("id", id).select();
      expect(update.data ?? []).toHaveLength(0);
      expect(await status(id as string)).toBe("confirmed");
    });

    it("bookings and guests cannot be deleted, only cancelled", async () => {
      const unit = await newUnit(ownerA.client, orgA, propA);
      const { data: id } = await book(ownerA.client, { unit, from: "2030-10-10", to: "2030-10-11" });
      await ownerA.client.from("bookings").delete().eq("id", id);
      expect(await status(id as string)).toBe("confirmed");
    });

    it("a unit with bookings cannot be deleted", async () => {
      const unit = await newUnit(ownerA.client, orgA, propA);
      await book(ownerA.client, { unit, from: "2030-10-15", to: "2030-10-16" });
      const { error } = await ownerA.client.from("units").delete().eq("id", unit);
      expect(error?.code).toBe("23503");
    });

    it("a suspended organization reads its bookings but cannot create or change them", async () => {
      const owner = await newUser("bksusp");
      const org = await newOrg(owner, "bksusp");
      const prop = await newProperty(owner.client, org);
      const unit = await newUnit(owner.client, org, prop);
      const { data: id } = await book(owner.client, { unit, from: "2030-11-01", to: "2030-11-03" });
      expect((await superadmin.client.rpc("suspend_subscription", { p_org: org })).error).toBeNull();

      expect((await owner.client.from("bookings").select("id").eq("id", id)).data).toHaveLength(1);
      expect((await book(owner.client, { unit, from: "2030-11-05", to: "2030-11-06" })).error).not.toBeNull();
      const update = await owner.client.from("bookings").update({ status: "cancelled" }).eq("id", id).select();
      expect(update.data ?? []).toHaveLength(0);
    });

    it("anonymous visitors see no bookings or guests and cannot book", async () => {
      const anon = anonClient();
      expect((await anon.from("bookings").select("id").limit(1)).data ?? []).toHaveLength(0);
      expect((await anon.from("guests").select("id").limit(1)).data ?? []).toHaveLength(0);
      const unit = await newUnit(ownerA.client, orgA, propA);
      expect((await book(anon, { unit, from: "2030-12-01", to: "2030-12-02" })).error).not.toBeNull();
    });

    it("every booking change is audited", async () => {
      const unit = await newUnit(ownerA.client, orgA, propA);
      const { data: id } = await book(operatorA.client, { unit, from: "2030-12-10", to: "2030-12-12", status: "provisional" });
      await operatorA.client.from("bookings").update({ status: "confirmed" }).eq("id", id);
      const { data } = await admin.from("audit_log").select("action, actor_id").eq("table_name", "bookings").eq("record_id", id);
      expect(data?.map((r) => r.action).sort()).toEqual(["insert", "update"]);
      expect(data?.every((r) => r.actor_id === operatorA.id)).toBe(true);
    });
  });
});
