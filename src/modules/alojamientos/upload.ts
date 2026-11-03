import { mediaPath, type EncodedType } from "./image";

// Upload flow for property and unit photos. The steps are injected so the flow can be tested
// without a browser; the uploader component wires the real ones (canvas, Storage, server action).

export type UploadTarget = { orgId: string; propertyId: string; unitId: string | null };

export type UploadDeps = {
  resize: (file: File) => Promise<{ blob: Blob; type: EncodedType }>;
  store: (path: string, blob: Blob, contentType: EncodedType) => Promise<void>;
  register: (media: { propertyId: string; unitId: string | null; storagePath: string }) => Promise<void>;
  /** Removes a stored file whose registration failed. */
  discard: (path: string) => Promise<void>;
  newId: () => string;
};

export type UploadStep = "resize" | "store" | "register";
export type UploadFailure = { name: string; step: UploadStep };

/** Resizes, stores and registers each file in order. A failed file is reported and skipped. */
export async function uploadPhotos(
  files: File[],
  target: UploadTarget,
  deps: UploadDeps,
  onProgress?: (current: number, total: number) => void,
): Promise<{ total: number; failed: number; failures: UploadFailure[] }> {
  const failures: UploadFailure[] = [];
  for (const [index, file] of files.entries()) {
    onProgress?.(index + 1, files.length);
    let step: UploadStep = "resize";
    let stored: string | null = null;
    try {
      const { blob, type } = await deps.resize(file);
      const path = mediaPath(target.orgId, target.propertyId, deps.newId(), type);
      step = "store";
      await deps.store(path, blob, type);
      stored = path;
      step = "register";
      await deps.register({ propertyId: target.propertyId, unitId: target.unitId, storagePath: path });
    } catch {
      failures.push({ name: file.name, step });
      // Best effort: the server also removes the file when it refuses the row.
      if (stored) await deps.discard(stored).catch(() => {});
    }
  }
  return { total: files.length, failed: failures.length, failures };
}

type RandomSource = { randomUUID?: () => string; getRandomValues: (array: Uint8Array) => Uint8Array };

/**
 * UUID v4 for a file name. `crypto.randomUUID` only exists in secure contexts (HTTPS or localhost),
 * so on a LAN IP over HTTP it is built from `getRandomValues`, which is available everywhere.
 */
export function randomFileId(source: RandomSource = globalThis.crypto): string {
  if (typeof source.randomUUID === "function") return source.randomUUID();
  const bytes = source.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
