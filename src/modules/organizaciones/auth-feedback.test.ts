import { describe, expect, it } from "vitest";

import { loginErrorMessage, registrationNotice, registrationRedirect } from "./auth-feedback";

describe("loginErrorMessage", () => {
  it("asks to confirm the email when it is not confirmed", () => {
    expect(loginErrorMessage({ code: "email_not_confirmed", status: 400 })).toBe(
      "Confirmá tu email antes de ingresar. Revisá tu bandeja de entrada.",
    );
  });

  it.each([{ status: 429 }, { code: "over_request_rate_limit", status: 400 }])(
    "reports the rate limit instead of a wrong password (%o)",
    (error) => {
      expect(loginErrorMessage(error)).toBe(
        "Hubo demasiados intentos de ingreso. Esperá unos minutos y volvé a intentar.",
      );
    },
  );

  it("keeps the generic message for wrong credentials (no account enumeration)", () => {
    expect(loginErrorMessage({ code: "invalid_credentials", status: 400 })).toBe("Email o contraseña incorrectos.");
    expect(loginErrorMessage({})).toBe("Email o contraseña incorrectos.");
  });
});

describe("registrationRedirect", () => {
  it("follows next when the organization was created or nothing was pending", () => {
    expect(registrationRedirect("created", "/panel/reservas")).toBe("/panel/reservas");
    expect(registrationRedirect("skipped", "/auth/invitacion/abc")).toBe("/auth/invitacion/abc");
  });

  it("sends the user to the panel with a notice when the slug is taken or it failed", () => {
    expect(registrationRedirect("slug_taken", "/panel/reservas")).toBe("/panel?registro=direccion");
    expect(registrationRedirect("error", "/panel")).toBe("/panel?registro=error");
  });
});

describe("registrationNotice", () => {
  it("explains each failure and ignores unknown values", () => {
    expect(registrationNotice("direccion")).toMatch(/ya está en uso/);
    expect(registrationNotice("error")).toMatch(/No pudimos registrar tu negocio/);
    expect(registrationNotice("otra")).toBeNull();
    expect(registrationNotice(undefined)).toBeNull();
  });
});
