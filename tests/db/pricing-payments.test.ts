import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { adminClient, anonClient, assertDbEnv, createTestUser, newToken, uniqueSlug, type TestUser } from "./helpers";

// Phase 5: rate rules, length discounts, holidays and guest payments. Invariants 4 (isolation),
// 5 (an operator cannot change rates), 6 (suspended = read-only), 7 (anon sees nothing), 8 (a frozen
// price does not follow rate edits), plus the payment rules: any member records, only owner/admin
// voids, nothing is erased and the client never sets currency or author.
assertDbEnv();
const skipDb = process.env.SKIP_DB_TESTS === "1";

const CHECK = "23514";
const FK = "23503";
const UNIQUE = "23505";

describe.skipIf(skipDb)("rates and guest payments (Phase 5)", () => {
  let admin: SupabaseClient;
  const users: TestUser[] = [];
  const orgIds: string[] = [];

  let superadmin: TestUser;
  let ownerA: TestUser;
  let adminA: TestUser;
  let operatorA: TestUser;
  let ownerB: TestUser;
  let orgA: string;
  let orgB: string;
  let propA: string;
  let unitA: string;
  let bookingA: string;
  let blockA: string;

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

  async function join(owner: TestUser, org: string, member: TestUser, role: "admin" | "operator") {
    const { token, hash } = newToken();
    await owner.client.from("invitations").insert({ org_id: org, role, token_hash: hash, created_by: owner.id });
    expect((await member.client.rpc("accept_invitation", { p_token: token })).error).toBeNull();
  }

  async function newProperty(client: SupabaseClient, org: string) {
    const { data, error } = await client.from("properties").insert({ org_id: org, slug: uniqueSlug("tp"), name: "Cabañas" }).select("id").single();
    expect(error).toBeNull();
    return data!.id as string;
  }

  async function newUnit(client: SupabaseClient, org: string, property: string) {
    const { data, error } = await client
      .from("units")
      .insert({ org_id: org, property_id: property, kind: "cabin", name: uniqueSlug("u"), max_guests: 4 })
      .select("id")
      .single();
    expect(error).toBeNull();
    return data!.id as string;
  }

  async function book(client: SupabaseClient, unit: string, from: string, to: string, kind: "booking" | "block" = "booking") {
    const { data, error } = await client.rpc("create_booking", {
      p_unit: unit,
      p_check_in: from,
      p_check_out: to,
      p_kind: kind,
      p_status: "confirmed",
      p_guests_count: kind === "block" ? undefined : 2,
      p_guest_name: kind === "block" ? undefined : "Ana Pérez",
    });
    expect(error).toBeNull();
    return data as string;
  }

  const baseRule = (values: Record<string, unknown> = {}) => ({
    org_id: orgA,
    property_id: propA,
    unit_id: unitA,
    kind: "base",
    name: "Base",
    price_cents: 10_000_00,
    ...values,
  });

  const payment = (values: Record<string, unknown> = {}) => ({
    org_id: orgA,
    booking_id: bookingA,
    kind: "deposit",
    method: "transfer",
    amount_cents: 30_000_00,
    ...values,
  });

  beforeAll(async () => {
    admin = adminClient();
    [superadmin, ownerA, adminA, operatorA, ownerB] = await Promise.all([
      newUser("tpsuper"),
      newUser("tpownera"),
      newUser("tpadmina"),
      newUser("tpopa"),
      newUser("tpownerb"),
    ]);
    await admin.from("platform_admins").insert({ user_id: superadmin.id });
    orgA = await newOrg(ownerA, "tpa");
    orgB = await newOrg(ownerB, "tpb");
    await join(ownerA, orgA, adminA, "admin");
    await join(ownerA, orgA, operatorA, "operator");
    propA = await newProperty(ownerA.client, orgA);
    unitA = await newUnit(ownerA.client, orgA, propA);
    bookingA = await book(ownerA.client, unitA, "2031-01-10", "2031-01-13");
    blockA = await book(ownerA.client, unitA, "2031-02-10", "2031-02-12", "block");
  });

  afterAll(async () => {
    if (orgIds.length) {
      await admin.from("audit_log").delete().in("org_id", orgIds);
      await admin.from("organizations").delete().in("id", orgIds);
    }
    await admin.from("holidays").delete().in("date", ["2031-07-09", "2031-07-10"]);
    for (const user of users) await admin.auth.admin.deleteUser(user.id);
  });

  describe("rate rules and length discounts", () => {
    it("owner and admin manage rates; an operator cannot create, change or delete them (invariant 5)", async () => {
      const own = await ownerA.client.from("rate_rules").insert(baseRule()).select("id").single();
      expect(own.error).toBeNull();
      expect((await adminA.client.from("rate_rules").insert(baseRule({ kind: "weekend", name: "Finde" })).select("id").single()).error).toBeNull();

      expect((await operatorA.client.from("rate_rules").insert(baseRule({ name: "Op" }))).error).not.toBeNull();
      const update = await operatorA.client.from("rate_rules").update({ price_cents: 1 }).eq("id", own.data!.id).select();
      expect(update.data ?? []).toHaveLength(0);
      const del = await operatorA.client.from("rate_rules").delete().eq("id", own.data!.id).select();
      expect(del.data ?? []).toHaveLength(0);
      const { data } = await admin.from("rate_rules").select("price_cents").eq("id", own.data!.id).single();
      expect(data!.price_cents).toBe(10_000_00);

      // The operator still reads them (same read rule as the rest of the organization's data).
      expect((await operatorA.client.from("rate_rules").select("id").eq("id", own.data!.id)).data).toHaveLength(1);
    });

    it("a rule targets exactly one unit or category of its own property, with consistent dates", async () => {
      expect((await ownerA.client.from("rate_rules").insert(baseRule({ unit_id: null }))).error?.code).toBe(CHECK);
      expect((await ownerA.client.from("rate_rules").insert(baseRule({ kind: "season", name: "Verano" }))).error?.code).toBe(CHECK);
      expect(
        (await ownerA.client.from("rate_rules").insert(baseRule({ date_from: "2031-02-01", date_to: "2031-01-01" }))).error?.code,
      ).toBe(CHECK);
      expect((await ownerA.client.from("rate_rules").insert(baseRule({ guests_included: 2 }))).error?.code).toBe(CHECK);

      const otherProp = await newProperty(ownerA.client, orgA);
      const otherUnit = await newUnit(ownerA.client, orgA, otherProp);
      expect((await ownerA.client.from("rate_rules").insert(baseRule({ unit_id: otherUnit }))).error?.code).toBe(FK);
    });

    it("where a rule applies cannot be changed after creating it", async () => {
      const { data } = await ownerA.client.from("rate_rules").insert(baseRule()).select("id").single();
      const otherUnit = await newUnit(ownerA.client, orgA, propA);
      expect((await ownerA.client.from("rate_rules").update({ unit_id: otherUnit }).eq("id", data!.id)).error).not.toBeNull();
    });

    it("length discounts: owner yes, operator no, one per number of nights", async () => {
      const row = { org_id: orgA, property_id: propA, min_nights: 7, pct: 10 };
      expect((await ownerA.client.from("length_discounts").insert(row)).error).toBeNull();
      expect((await ownerA.client.from("length_discounts").insert(row)).error?.code).toBe(UNIQUE);
      expect((await operatorA.client.from("length_discounts").insert({ ...row, min_nights: 14 })).error).not.toBeNull();
      expect((await ownerA.client.from("length_discounts").insert({ ...row, min_nights: 3, pct: 101 })).error?.code).toBe(CHECK);
    });

    it("another organization neither sees nor writes them (invariant 4)", async () => {
      expect((await ownerB.client.from("rate_rules").select("id").eq("org_id", orgA)).data).toHaveLength(0);
      expect((await ownerB.client.from("length_discounts").select("id").eq("org_id", orgA)).data).toHaveLength(0);
      expect((await ownerB.client.from("rate_rules").insert(baseRule())).error).not.toBeNull();
    });
  });

  describe("holidays", () => {
    it("only the platform admin loads them; every member reads them", async () => {
      expect((await superadmin.client.from("holidays").insert({ date: "2031-07-09", name: "Independencia" })).error).toBeNull();
      expect((await ownerA.client.from("holidays").insert({ date: "2031-07-10", name: "Inventado" })).error).not.toBeNull();
      expect((await operatorA.client.from("holidays").select("date").eq("date", "2031-07-09")).data).toHaveLength(1);
      const del = await ownerA.client.from("holidays").delete().eq("date", "2031-07-09").select();
      expect(del.data ?? []).toHaveLength(0);
    });
  });

  describe("guest payments", () => {
    it("any member records a payment; currency and author come from the database", async () => {
      const { data, error } = await operatorA.client.from("booking_payments").insert(payment()).select("currency, recorded_by, voided_at").single();
      expect(error).toBeNull();
      expect(data).toEqual({ currency: "ARS", recorded_by: operatorA.id, voided_at: null });
    });

    it("refunds (money going out) are recorded only by owner or admin", async () => {
      expect((await operatorA.client.from("booking_payments").insert(payment({ kind: "refund", amount_cents: 1 }))).error).not.toBeNull();
      expect((await adminA.client.from("booking_payments").insert(payment({ kind: "refund", amount_cents: 1 }))).error).toBeNull();
    });

    it("the client cannot set the author, the currency or a voided date", async () => {
      expect((await ownerA.client.from("booking_payments").insert(payment({ recorded_by: ownerB.id }))).error).not.toBeNull();
      expect((await ownerA.client.from("booking_payments").insert(payment({ currency: "USD" }))).error).not.toBeNull();
      expect((await ownerA.client.from("booking_payments").insert(payment({ voided_at: "2031-01-01T00:00:00Z" }))).error).not.toBeNull();
    });

    it("rejects payments on a block, zero amounts and bookings of another organization", async () => {
      expect((await ownerA.client.from("booking_payments").insert(payment({ booking_id: blockA }))).error?.message).toBe("invalid_payment");
      expect((await ownerA.client.from("booking_payments").insert(payment({ amount_cents: 0 }))).error?.code).toBe(CHECK);
      expect((await ownerB.client.from("booking_payments").insert(payment({ org_id: orgB }))).error).not.toBeNull();
      expect((await ownerB.client.from("booking_payments").insert(payment())).error).not.toBeNull();
    });

    it("only owner or admin void a payment, once; amounts never change and nothing is deleted", async () => {
      const { data: p } = await operatorA.client.from("booking_payments").insert(payment({ kind: "payment" })).select("id").single();
      const id = p!.id as string;
      const now = new Date().toISOString();

      const byOperator = await operatorA.client.from("booking_payments").update({ voided_at: now }).eq("id", id).select();
      expect(byOperator.data ?? []).toHaveLength(0);
      expect((await adminA.client.from("booking_payments").update({ amount_cents: 1 }).eq("id", id)).error).not.toBeNull();

      const voided = await adminA.client.from("booking_payments").update({ voided_at: now }).eq("id", id).select("voided_at").single();
      expect(voided.error).toBeNull();
      expect(voided.data!.voided_at).not.toBeNull();
      expect((await ownerA.client.from("booking_payments").update({ voided_at: now }).eq("id", id)).error?.message).toBe("already_voided");

      expect((await ownerA.client.from("booking_payments").delete().eq("id", id)).error).not.toBeNull();
      expect((await admin.from("booking_payments").select("amount_cents").eq("id", id).single()).data!.amount_cents).toBe(30_000_00);
    });

    it("another organization does not see them (invariant 4)", async () => {
      expect((await ownerB.client.from("booking_payments").select("id").eq("booking_id", bookingA)).data).toHaveLength(0);
    });
  });

  describe("frozen price", () => {
    it("only the server path (service_role) writes amounts, and a rate edit does not touch them (invariant 8)", async () => {
      const { data: r } = await ownerA.client.from("rate_rules").insert(baseRule({ name: "Base congelada" })).select("id").single();

      // Member session: rejected (bookings_guard, Phase 4).
      expect((await ownerA.client.from("bookings").update({ total_cents: 1 }).eq("id", bookingA)).error?.message).toBe("immutable_field");

      const frozen = { total_cents: 30_000_00, deposit_cents: 9_000_00, price_breakdown: { nights: 3 } };
      const write = await admin.from("bookings").update(frozen).eq("id", bookingA).select("total_cents, deposit_cents").single();
      expect(write.error).toBeNull();
      expect(write.data).toEqual({ total_cents: 30_000_00, deposit_cents: 9_000_00 });

      expect((await ownerA.client.from("rate_rules").update({ price_cents: 99_000_00 }).eq("id", r!.id)).error).toBeNull();
      const { data } = await admin.from("bookings").select("total_cents, deposit_cents, price_breakdown").eq("id", bookingA).single();
      expect(data).toEqual(frozen);
    });
  });

  describe("suspension and anonymous visitors", () => {
    it("a suspended organization keeps reading but records no payments and changes no rates (invariant 6)", async () => {
      const owner = await newUser("tpsusp");
      const org = await newOrg(owner, "tpsusp");
      const prop = await newProperty(owner.client, org);
      const unit = await newUnit(owner.client, org, prop);
      const booking = await book(owner.client, unit, "2031-03-01", "2031-03-03");
      const rule = await owner.client
        .from("rate_rules")
        .insert({ org_id: org, property_id: prop, unit_id: unit, kind: "base", name: "Base", price_cents: 1 })
        .select("id")
        .single();
      expect(rule.error).toBeNull();
      expect((await superadmin.client.rpc("suspend_subscription", { p_org: org })).error).toBeNull();

      expect((await owner.client.from("rate_rules").select("id").eq("id", rule.data!.id)).data).toHaveLength(1);
      const update = await owner.client.from("rate_rules").update({ price_cents: 2 }).eq("id", rule.data!.id).select();
      expect(update.data ?? []).toHaveLength(0);
      const pay = await owner.client
        .from("booking_payments")
        .insert({ org_id: org, booking_id: booking, kind: "deposit", method: "cash", amount_cents: 1 });
      expect(pay.error).not.toBeNull();
    });

    it("anonymous visitors read no rates, discounts, holidays or payments (invariant 7)", async () => {
      const anon = anonClient();
      for (const table of ["rate_rules", "length_discounts", "holidays", "booking_payments"] as const) {
        const { data, error } = await anon.from(table).select("*").limit(1);
        expect(error?.code ?? (data?.length === 0 ? "empty" : "rows"), table).not.toBe("rows");
      }
      expect((await anon.from("booking_payments").insert(payment())).error).not.toBeNull();
    });
  });
});
