import { describe, expect, it } from "vitest";

import { messageFor, ownMessage } from "./notice";

const MESSAGES = { guardado: "Cambios guardados.", escritura: "No se pudo guardar." };

describe("ownMessage", () => {
  it("returns the message for a known key", () => {
    expect(ownMessage(MESSAGES, "guardado")).toBe("Cambios guardados.");
  });

  it.each(["__proto__", "constructor", "toString", "hasOwnProperty", "otra", undefined, ["guardado"]])(
    "ignores keys that are not its own (%s)",
    (key) => {
      expect(ownMessage(MESSAGES, key)).toBeUndefined();
    },
  );
});

describe("messageFor", () => {
  it("maps ?ok= and ?error= to their messages", () => {
    expect(messageFor({ ok: "guardado" }, MESSAGES)).toEqual({ tone: "success", text: "Cambios guardados." });
    expect(messageFor({ error: "escritura" }, MESSAGES)).toEqual({ tone: "error", text: "No se pudo guardar." });
  });

  it("uses the generic error for an unknown or inherited error key, never an object", () => {
    for (const error of ["otra", "__proto__", "constructor"]) {
      expect(messageFor({ error }, MESSAGES)).toEqual({ tone: "error", text: "No se pudo completar la operación." });
    }
  });

  it("shows nothing for an unknown or inherited ok key", () => {
    expect(messageFor({ ok: "__proto__" }, MESSAGES)).toBeNull();
    expect(messageFor({ ok: "otra" }, MESSAGES)).toBeNull();
    expect(messageFor({}, MESSAGES)).toBeNull();
  });
});
