import { Notice } from "@/components/shell/notice";
import { Button } from "@/components/ui/button";
import { deleteMediaAction } from "@/modules/alojamientos/actions";
import { publicMediaUrl } from "@/modules/alojamientos/media-url";
import type { Media } from "@/modules/alojamientos/queries";

export function ReadOnlyNotice() {
  return (
    <Notice tone="warning">
      La cuenta está suspendida, vencida, dada de baja o desactivada: los alojamientos quedan en solo lectura y los datos se conservan.
    </Notice>
  );
}

export const MESSAGES: Record<string, string> = {
  guardado: "Cambios guardados.",
  publicado: "Establecimiento publicado.",
  despublicado: "El establecimiento ya no es público.",
  categoria: "Categoría agregada.",
  categoria_guardada: "Categoría guardada.",
  establecimiento_borrado: "Establecimiento eliminado.",
  confirmar_borrado: "Marcá la confirmación para eliminar el establecimiento.",
  establecimiento_con_reservas:
    "No se puede eliminar: tiene reservas o bloqueos cargados. Despublicalo para que deje de verse en la página pública.",
  categoria_borrada: "Categoría eliminada. Sus unidades quedaron sin categoría.",
  unidad: "Unidad agregada.",
  unidad_borrada: "Unidad eliminada.",
  comodidades: "Comodidades guardadas.",
  foto_borrada: "Foto eliminada.",
  establecimiento_invalido: "Revisá el nombre y la dirección web (al menos 3 letras o números, sin palabras reservadas).",
  direccion_en_uso: "Esa dirección web ya está en uso. Elegí otra.",
  datos_invalidos:
    "Revisá los datos: WhatsApp con código de país, horas HH:MM, coordenadas en par, reserva provisional de 6 a 12 horas y seña de 0 a 100 %.",
  categoria_invalida: "Ingresá un nombre de categoría (2 a 80 caracteres).",
  unidad_invalida: "Revisá la unidad: nombre, tipo y cantidad de huéspedes (1 a 50).",
  limite_unidades: "Llegaste al máximo de unidades de tu plan.",
  escritura:
    "No se pudo guardar. Si la cuenta está suspendida o vencida, el panel es de solo lectura; si no, intentá de nuevo.",
};

export { selectClass, textareaClass } from "@/components/ui/native-controls";

export function PhotoGrid({
  media,
  propertyId,
  unitId,
  canEdit,
}: {
  media: Media[];
  propertyId: string;
  unitId?: string;
  canEdit: boolean;
}) {
  if (!media.length) return <p className="text-sm text-muted-foreground">Todavía no hay fotos.</p>;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {media.map((m, i) => (
        <li key={m.id} className="grid gap-2">
          {/* Already resized in the browser and served from Storage: next/image would only re-proxy it. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={publicMediaUrl(m.storage_path)}
            alt={m.alt || "Foto del alojamiento"}
            loading="lazy"
            className="aspect-[4/3] w-full rounded-lg border object-cover"
          />
          {canEdit ? (
            <form action={deleteMediaAction}>
              <input type="hidden" name="propertyId" value={propertyId} />
              <input type="hidden" name="mediaId" value={m.id} />
              {unitId ? (
                <>
                  <input type="hidden" name="unitId" value={unitId} />
                  <input type="hidden" name="back" value="unit" />
                </>
              ) : null}
              <Button type="submit" size="sm" variant="outline" className="w-full" aria-label={`Quitar foto ${i + 1}`}>
                Quitar
              </Button>
            </form>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
