import { describe, expect, it } from "vitest";

import { propertyHref, searchQuerySchema } from "./search";

describe("searchQuerySchema", () => {
  const today = "2041-03-01";
  const parse = (q: Record<string, string>) => searchQuerySchema(today).safeParse(q);

  it("accepts an empty search (everything), trimming blanks", () => {
    expect(parse({}).data).toEqual({ query: "", checkIn: null, checkOut: null, guests: null });
    expect(parse({ q: "  ", ingreso: "", salida: "", huespedes: "" }).data).toEqual({
      query: "",
      checkIn: null,
      checkOut: null,
      guests: null,
    });
  });

  it("accepts a place, dates and guests", () => {
    expect(parse({ q: " Nono ", ingreso: "2041-03-10", salida: "2041-03-13", huespedes: "3" }).data).toEqual({
      query: "Nono",
      checkIn: "2041-03-10",
      checkOut: "2041-03-13",
      guests: 3,
    });
  });

  it.each([
    ["only one date", { ingreso: "2041-03-10" }],
    ["checkout not after checkin", { ingreso: "2041-03-10", salida: "2041-03-10" }],
    ["past checkin", { ingreso: "2041-02-20", salida: "2041-02-22" }],
    ["more than 365 nights", { ingreso: "2041-03-10", salida: "2042-03-11" }],
    ["zero guests", { huespedes: "0" }],
    ["a query over 80 characters", { q: "x".repeat(81) }],
  ])("rejects %s", (_, q) => {
    expect(parse(q as Record<string, string>).success).toBe(false);
  });
});

describe("propertyHref", () => {
  it("carries the dates and guests to the property page", () => {
    expect(propertyHref("cabanas-del-rio", { checkIn: "2041-03-10", checkOut: "2041-03-13", guests: 2 })).toBe(
      "/cabanas-del-rio?ingreso=2041-03-10&salida=2041-03-13&huespedes=2#disponibilidad",
    );
  });

  it("uses two guests when only dates were given, and a bare link without dates", () => {
    expect(propertyHref("rio", { checkIn: "2041-03-10", checkOut: "2041-03-13", guests: null })).toBe(
      "/rio?ingreso=2041-03-10&salida=2041-03-13&huespedes=2#disponibilidad",
    );
    expect(propertyHref("rio", { checkIn: null, checkOut: null, guests: 4 })).toBe("/rio");
  });
});
