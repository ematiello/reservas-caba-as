"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { registerMediaAction } from "@/modules/alojamientos/actions";
import { resizeImage } from "@/modules/alojamientos/image";
import { uploadPhotos } from "@/modules/alojamientos/upload";

type Props = { orgId: string; propertyId: string; unitId?: string };

// Resizes each photo in the browser, uploads it to Storage under {org}/{property}/ (the Storage
// policies check that path), then registers it. Full-size originals never leave the device.
export function PhotoUploader({ orgId, propertyId, unitId }: Props) {
  const router = useRouter();
  const inputId = useId();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { failed } = await uploadPhotos(
        files,
        { orgId, propertyId, unitId: unitId ?? null },
        {
          resize: resizeImage,
          store: async (path, blob, contentType) => {
            const { error } = await supabase.storage.from("media").upload(path, blob, { contentType });
            if (error) throw error;
          },
          register: async ({ storagePath }) => {
            const result = await registerMediaAction({ propertyId, unitId: unitId ?? "", storagePath, alt: "" });
            if (result.error) throw new Error(result.error);
          },
          newId: () => crypto.randomUUID(),
        },
        (current, total) => setStatus(`Subiendo ${current} de ${total}…`),
      );
      setStatus(failed ? `No se pudieron subir ${failed} de ${files.length} fotos.` : "Fotos subidas.");
      router.refresh();
    } catch {
      setStatus("No se pudieron subir las fotos.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={inputId}>Agregar fotos</Label>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        multiple
        disabled={busy}
        onChange={onChange}
        className="text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5"
      />
      <p role="status" className="text-sm text-muted-foreground">
        {status ?? "Se achican automáticamente antes de subir."}
      </p>
    </div>
  );
}
