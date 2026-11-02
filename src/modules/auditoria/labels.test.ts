import { describe, expect, it } from "vitest";

import { changedFields, describeAudit } from "./labels";

describe("describeAudit", () => {
  it("names an insert by the row's name", () => {
    expect(describeAudit({ action: "insert", table_name: "holidays", diff: { new: { date: "2031-05-02", name: "Fiesta" } } })).toEqual({
      title: "Alta de feriado",
      detail: "Fiesta",
    });
  });

  it("lists what an update changed, without bookkeeping columns", () => {
    const diff = {
      old: { status: "trial", updated_at: "a", grace_days: 0 },
      new: { status: "cancelled", updated_at: "b", grace_days: 0 },
    };
    expect(describeAudit({ action: "update", table_name: "subscriptions", diff })).toEqual({
      title: "Cambio en suscripción",
      detail: "estado: trial → cancelled",
    });
  });

  it("describes a platform access to bookings or guests", () => {
    expect(describeAudit({ action: "view", table_name: "guests", diff: null })).toEqual({
      title: "La plataforma consultó los huéspedes",
      detail: null,
    });
  });

  it("falls back to the raw table name for a table it does not know", () => {
    expect(describeAudit({ action: "delete", table_name: "other", diff: null })).toEqual({ title: "Baja de other", detail: null });
  });
});

describe("changedFields", () => {
  it("caps a long list and says how many more there are", () => {
    const old = { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1 };
    const changes = changedFields({ old, new: { a: 2, b: 2, c: 2, d: 2, e: 2, f: 2 } }, 4);
    expect(changes).toHaveLength(5);
    expect(changes.at(-1)).toBe("y 2 más");
  });

  it("returns nothing when the diff is not an update", () => {
    expect(changedFields({ new: { a: 1 } })).toEqual([]);
  });
});
