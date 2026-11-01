import { describe, expect, it } from "vitest";

import { categorySchema, newPropertySchema, propertySchema, unitSchema } from "./schemas";

describe("newPropertySchema", () => {
  it("derives the slug from the name when empty", () => {
    expect(newPropertySchema.parse({ name: " Cabañas del Lago ", slug: "" })).toEqual({
      name: "Cabañas del Lago",
      slug: "cabanas-del-lago",
    });
  });

  it("rejects reserved or too short slugs", () => {
    expect(newPropertySchema.safeParse({ name: "Panel", slug: "panel" }).success).toBe(false);
    expect(newPropertySchema.safeParse({ name: "Ab", slug: "" }).success).toBe(false);
  });
});

describe("propertySchema", () => {
  const base = {
    name: "Cabañas del Lago",
    description: "",
    address: "",
    city: "Villa Carlos Paz",
    province: "Córdoba",
    lat: "",
    lng: "",
    whatsapp: "+54 9 351 555-1234",
    checkInTime: "14:00",
    checkOutTime: "",
    cleaningBufferDays: "0",
    provisionalHoldHours: "12",
    depositPct: "30",
  };

  it("normalizes empty optional fields to null and the WhatsApp number to digits", () => {
    const parsed = propertySchema.parse(base);
    expect(parsed).toMatchObject({
      address: null,
      city: "Villa Carlos Paz",
      lat: null,
      lng: null,
      whatsapp: "5493515551234",
      checkInTime: "14:00",
      checkOutTime: null,
      cleaningBufferDays: 0,
      provisionalHoldHours: 12,
      depositPct: 30,
    });
  });

  it("accepts coordinates only as a pair and within range", () => {
    expect(propertySchema.parse({ ...base, lat: "-31.42", lng: "-64.5" })).toMatchObject({ lat: -31.42, lng: -64.5 });
    expect(propertySchema.safeParse({ ...base, lat: "-31.42", lng: "" }).success).toBe(false);
    expect(propertySchema.safeParse({ ...base, lat: "-91", lng: "0" }).success).toBe(false);
  });

  it("enforces the hold hours (6 to 12) and the deposit percentage", () => {
    expect(propertySchema.safeParse({ ...base, provisionalHoldHours: "5" }).success).toBe(false);
    expect(propertySchema.safeParse({ ...base, depositPct: "101" }).success).toBe(false);
  });

  it("rejects a WhatsApp number that is too short", () => {
    expect(propertySchema.safeParse({ ...base, whatsapp: "1234" }).success).toBe(false);
  });
});

describe("unitSchema", () => {
  it("parses a unit with an optional category", () => {
    expect(
      unitSchema.parse({ name: "Cabaña 1", kind: "cabin", maxGuests: "4", bedrooms: "2", beds: "", categoryId: "", description: "", isPublished: "on" }),
    ).toEqual({
      name: "Cabaña 1",
      kind: "cabin",
      maxGuests: 4,
      bedrooms: 2,
      beds: null,
      categoryId: null,
      description: "",
      isPublished: true,
    });
  });

  it("requires at least one guest and a known kind", () => {
    const base = { name: "X", kind: "cabin", maxGuests: "1", bedrooms: "", beds: "", categoryId: "", description: "" };
    expect(unitSchema.safeParse({ ...base, maxGuests: "0" }).success).toBe(false);
    expect(unitSchema.safeParse({ ...base, kind: "castle" }).success).toBe(false);
  });
});

describe("categorySchema", () => {
  it("trims the name", () => {
    expect(categorySchema.parse({ name: "  Dobles ", description: "" })).toEqual({ name: "Dobles", description: "" });
  });
});
