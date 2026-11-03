import { describe, expect, it } from "vitest";

import { isUnitFree, stayQuerySchema, whatsappLink } from "./stay";

describe("isUnitFree", () => {
  const taken = [{ unitId: "u1", startsOn: "2041-03-10", endsOn: "2041-03-14" }];

  it("is free when no occupied range touches the stay", () => {
    expect(isUnitFree("u1", taken, "2041-03-14", "2041-03-16", 0)).toBe(true);
    expect(isUnitFree("u2", taken, "2041-03-10", "2041-03-12", 0)).toBe(true);
  });

  it("is taken when the stay overlaps an occupied range (end exclusive)", () => {
    expect(isUnitFree("u1", taken, "2041-03-13", "2041-03-15", 0)).toBe(false);
    expect(isUnitFree("u1", taken, "2041-03-05", "2041-03-11", 0)).toBe(false);
  });

  it("counts the stay's own cleaning days, like the database exclusion", () => {
    // Leaving on the 10th plus one cleaning day occupies the 10th, where the next stay starts.
    expect(isUnitFree("u1", taken, "2041-03-07", "2041-03-10", 0)).toBe(true);
    expect(isUnitFree("u1", taken, "2041-03-07", "2041-03-10", 1)).toBe(false);
  });
});

describe("stayQuerySchema", () => {
  const today = "2041-03-01";

  it("accepts a future stay and coerces the guests", () => {
    const parsed = stayQuerySchema(today).safeParse({ ingreso: "2041-03-10", salida: "2041-03-13", huespedes: "2" });
    expect(parsed.success && parsed.data).toEqual({ checkIn: "2041-03-10", checkOut: "2041-03-13", guests: 2 });
  });

  it.each([
    ["checkout before checkin", { ingreso: "2041-03-10", salida: "2041-03-10", huespedes: "2" }],
    ["past checkin", { ingreso: "2041-02-27", salida: "2041-03-02", huespedes: "2" }],
    ["too many nights", { ingreso: "2041-03-10", salida: "2042-03-11", huespedes: "2" }],
    ["no guests", { ingreso: "2041-03-10", salida: "2041-03-13", huespedes: "0" }],
    ["not a date", { ingreso: "10/03/2041", salida: "2041-03-13", huespedes: "2" }],
  ])("rejects %s", (_, query) => {
    expect(stayQuerySchema(today).safeParse(query).success).toBe(false);
  });
});

describe("whatsappLink", () => {
  it("prefills a question about the unit and dates", () => {
    const link = whatsappLink("5493544123456", {
      propertyName: "Cabañas del Arroyo",
      unitName: "Cabaña Sauce",
      stay: { checkIn: "2041-03-10", checkOut: "2041-03-13", guests: 2 },
    });
    const url = new URL(link);
    expect(url.origin + url.pathname).toBe("https://wa.me/5493544123456");
    expect(url.searchParams.get("text")).toBe(
      "Hola, quiero consultar por Cabaña Sauce en Cabañas del Arroyo, del 10/03/2041 al 13/03/2041, para 2 huéspedes.",
    );
  });

  it("asks in general without a stay, and in singular for one guest", () => {
    expect(new URL(whatsappLink("5493544123456", { propertyName: "Cabañas del Arroyo" })).searchParams.get("text")).toBe(
      "Hola, quiero consultar por Cabañas del Arroyo.",
    );
    const one = whatsappLink("5493544123456", {
      propertyName: "Hostería",
      stay: { checkIn: "2041-03-10", checkOut: "2041-03-11", guests: 1 },
    });
    expect(new URL(one).searchParams.get("text")).toBe("Hola, quiero consultar por Hostería, del 10/03/2041 al 11/03/2041, para 1 huésped.");
  });
});
