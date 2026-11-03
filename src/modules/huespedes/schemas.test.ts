import { describe, expect, it } from "vitest";

import { guestSchema, searchTerm } from "./schemas";

const G = "11111111-1111-4111-8111-111111111111";

describe("guestSchema", () => {
  it("trims, and turns empty phone and email into null", () => {
    expect(guestSchema.parse({ guestId: G, fullName: " Ana Pérez ", phone: "", email: "", notes: " vuelve en marzo " })).toEqual({
      guestId: G,
      fullName: "Ana Pérez",
      phone: null,
      email: null,
      notes: "vuelve en marzo",
    });
  });

  it("rejects an empty name, a bad email and over-long fields", () => {
    const base = { guestId: G, fullName: "Ana", phone: "", email: "", notes: "" };
    expect(guestSchema.safeParse({ ...base, fullName: " " }).success).toBe(false);
    expect(guestSchema.safeParse({ ...base, email: "ana@" }).success).toBe(false);
    expect(guestSchema.safeParse({ ...base, phone: "1".repeat(41) }).success).toBe(false);
    expect(guestSchema.safeParse({ ...base, notes: "x".repeat(2001) }).success).toBe(false);
  });
});

describe("searchTerm", () => {
  it("keeps letters, digits, spaces, @ . + - and drops what would break the filter", () => {
    expect(searchTerm("  Ana, (Pérez)%* ")).toBe("Ana Pérez");
    expect(searchTerm("ana@mail.com")).toBe("ana@mail.com");
    expect(searchTerm("+54 351-555")).toBe("+54 351-555");
  });

  it("is empty for nothing usable, and caps the length", () => {
    expect(searchTerm(undefined)).toBe("");
    expect(searchTerm(",,()")).toBe("");
    expect(searchTerm("a".repeat(200))).toHaveLength(60);
  });
});
