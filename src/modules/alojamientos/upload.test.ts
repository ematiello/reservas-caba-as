import { describe, expect, it, vi } from "vitest";

import { isMediaPath } from "./image";
import { randomFileId, uploadPhotos, type UploadDeps } from "./upload";

const ORG = "11111111-1111-4111-8111-111111111111";
const PROP = "22222222-2222-4222-8222-222222222222";
const FILE_ID = "33333333-3333-4333-8333-333333333333";

function deps(overrides: Partial<UploadDeps> = {}): UploadDeps {
  return {
    resize: vi.fn(async () => ({ blob: new Blob(["x"]), type: "image/webp" as const })),
    store: vi.fn(async () => {}),
    register: vi.fn(async () => {}),
    discard: vi.fn(async () => {}),
    newId: () => FILE_ID,
    ...overrides,
  };
}

const file = (name: string) => new File(["x"], name, { type: "image/png" });

describe("uploadPhotos", () => {
  it("resizes, stores under {org}/{property}/ and registers each file, reporting progress", async () => {
    const d = deps();
    const progress: number[] = [];
    const result = await uploadPhotos([file("a.png"), file("b.png")], { orgId: ORG, propertyId: PROP, unitId: null }, d, (i) =>
      progress.push(i),
    );
    expect(result).toEqual({ total: 2, failed: 0, failures: [] });
    expect(progress).toEqual([1, 2]);
    const path = `${ORG}/${PROP}/${FILE_ID}.webp`;
    expect(d.store).toHaveBeenCalledWith(path, expect.any(Blob), "image/webp");
    expect(d.register).toHaveBeenCalledWith({ propertyId: PROP, unitId: null, storagePath: path });
  });

  it("counts a failed file and keeps going with the rest", async () => {
    const store = vi.fn().mockRejectedValueOnce(new Error("denied")).mockResolvedValue(undefined);
    const d = deps({ store });
    const result = await uploadPhotos([file("a.png"), file("b.png")], { orgId: ORG, propertyId: PROP, unitId: null }, d);
    expect(result).toEqual({ total: 2, failed: 1, failures: [{ name: "a.png", step: "store" }] });
    expect(d.register).toHaveBeenCalledTimes(1);
    expect(d.discard).not.toHaveBeenCalled();
  });

  it("reports which step failed for each file", async () => {
    const resize = vi.fn().mockRejectedValueOnce(new Error("not an image")).mockResolvedValue({ blob: new Blob(["x"]), type: "image/webp" });
    const result = await uploadPhotos([file("a.png"), file("b.png")], { orgId: ORG, propertyId: PROP, unitId: null }, deps({ resize }));
    expect(result.failures).toEqual([{ name: "a.png", step: "resize" }]);
  });

  it("discards the stored file when its registration fails, so it is not left orphaned", async () => {
    const d = deps({ register: vi.fn().mockRejectedValue(new Error("invalid")) });
    const result = await uploadPhotos([file("a.png")], { orgId: ORG, propertyId: PROP, unitId: "u" }, d);
    expect(result).toEqual({ total: 1, failed: 1, failures: [{ name: "a.png", step: "register" }] });
    expect(d.discard).toHaveBeenCalledWith(`${ORG}/${PROP}/${FILE_ID}.webp`);
  });

  it("still reports the registration failure when discarding also fails", async () => {
    const d = deps({ register: vi.fn().mockRejectedValue(new Error("invalid")), discard: vi.fn().mockRejectedValue(new Error("x")) });
    const result = await uploadPhotos([file("a.png")], { orgId: ORG, propertyId: PROP, unitId: null }, d);
    expect(result.failures).toEqual([{ name: "a.png", step: "register" }]);
  });
});

describe("randomFileId", () => {
  it("returns a UUID v4 without crypto.randomUUID (insecure contexts such as a LAN IP over HTTP)", () => {
    const ids = new Set(Array.from({ length: 50 }, () => randomFileId({ getRandomValues: (a: Uint8Array) => crypto.getRandomValues(a) })));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("prefers crypto.randomUUID when it exists", () => {
    expect(randomFileId({ randomUUID: () => FILE_ID, getRandomValues: (a: Uint8Array) => a })).toBe(FILE_ID);
  });
});

describe("isMediaPath", () => {
  it("accepts only {org}/{property}/{uuid}.webp|jpg", () => {
    expect(isMediaPath(ORG, PROP, `${ORG}/${PROP}/${FILE_ID}.webp`)).toBe(true);
    expect(isMediaPath(ORG, PROP, `${ORG}/${PROP}/${FILE_ID}.jpg`)).toBe(true);
    expect(isMediaPath(ORG, PROP, `${ORG}/${PROP}/../other/${FILE_ID}.jpg`)).toBe(false);
    expect(isMediaPath(ORG, PROP, `${ORG}/${PROP}/sub/${FILE_ID}.jpg`)).toBe(false);
    expect(isMediaPath(ORG, PROP, `${ORG}/${PROP}/${FILE_ID}.png`)).toBe(false);
    expect(isMediaPath(ORG, PROP, `${ORG}/other/${FILE_ID}.webp`)).toBe(false);
  });
});
