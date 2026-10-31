import { describe, expect, it } from "vitest";

import {
  invitationRoleSchema,
  loginSchema,
  registerCollaboratorSchema,
  registerSchema,
  slugify,
} from "./schemas";

const valid = {
  fullName: "Ana Pérez",
  email: "ana@example.com",
  password: "una-clave-larga",
  orgName: "Cabañas del Río",
  slug: "",
};

describe("slugify", () => {
  it("lowercases, strips accents and joins words with dashes", () => {
    expect(slugify("Cabañas del Río")).toBe("cabanas-del-rio");
  });

  it("drops symbols and trims leading and trailing dashes", () => {
    expect(slugify("  --Hotel & Spa!!  ")).toBe("hotel-spa");
  });

  it("caps the length at 40 characters without a trailing dash", () => {
    const slug = slugify("a".repeat(39) + " bbbb");
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("registerSchema", () => {
  it("accepts valid input and derives the slug from the organization name", () => {
    const result = registerSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.slug).toBe("cabanas-del-rio");
  });

  it("keeps an explicit slug, normalized", () => {
    const result = registerSchema.safeParse({ ...valid, slug: "Mi Casa" });
    expect(result.success && result.data.slug).toBe("mi-casa");
  });

  it.each(["admin", "panel", "api", "auth", "login"])("rejects the reserved slug %s", (slug) => {
    const result = registerSchema.safeParse({ ...valid, slug });
    expect(result.success).toBe(false);
  });

  it("rejects a slug shorter than 3 characters", () => {
    expect(registerSchema.safeParse({ ...valid, slug: "ab" }).success).toBe(false);
  });

  it("rejects short passwords and invalid emails", () => {
    expect(registerSchema.safeParse({ ...valid, password: "corta" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, email: "no-es-un-mail" }).success).toBe(false);
  });

  it("rejects passwords over 72 characters (bcrypt limit)", () => {
    expect(registerSchema.safeParse({ ...valid, password: "x".repeat(73) }).success).toBe(false);
  });

  it("trims names and rejects empty ones", () => {
    expect(registerSchema.safeParse({ ...valid, fullName: "   " }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, orgName: "" }).success).toBe(false);
  });
});

describe("registerCollaboratorSchema", () => {
  it("needs only name, email and password (no business)", () => {
    const result = registerCollaboratorSchema.safeParse({
      fullName: "Luis Gómez",
      email: "Luis@Example.com",
      password: "una-clave-larga",
    });
    expect(result.success && result.data.email).toBe("luis@example.com");
  });

  it("applies the same password and name rules", () => {
    const base = { fullName: "Luis Gómez", email: "luis@example.com", password: "una-clave-larga" };
    expect(registerCollaboratorSchema.safeParse({ ...base, password: "corta" }).success).toBe(false);
    expect(registerCollaboratorSchema.safeParse({ ...base, fullName: " " }).success).toBe(false);
  });
});

describe("invitationRoleSchema", () => {
  it("accepts admin and operator, never owner", () => {
    expect(invitationRoleSchema.safeParse("admin").success).toBe(true);
    expect(invitationRoleSchema.safeParse("operator").success).toBe(true);
    expect(invitationRoleSchema.safeParse("owner").success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("requires a valid email and a password", () => {
    expect(loginSchema.safeParse({ email: "ana@example.com", password: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "ana@example.com", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
  });
});
