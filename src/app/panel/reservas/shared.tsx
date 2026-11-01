import { Notice } from "@/components/shell/notice";
import type { BookingStatus } from "@/modules/reservas/calendar";

export { selectClass, textareaClass } from "../alojamientos/shared";

export const MESSAGES: Record<string, string> = {
  creada: "Reserva registrada.",
  bloqueo: "Fechas bloqueadas.",
  confirmed: "Reserva confirmada.",
  checked_in: "Check-in registrado.",
  checked_out: "Check-out registrado.",
  cancelled: "Cancelada: las fechas quedaron libres.",
  movida: "Reserva actualizada.",
  datos_invalidos: "Revisá los datos: fechas válidas con salida posterior al ingreso, nombre del huésped y de 1 a 50 huéspedes.",
  superpuesta: "Esas fechas se superponen con otra reserva o bloqueo de la unidad (incluye los días de limpieza).",
  capacidad: "La cantidad de huéspedes supera la capacidad de la unidad.",
  sin_unidad: "No queda ninguna unidad libre de esa categoría para esas fechas.",
  vencida: "La reserva provisional ya venció: registrala de nuevo.",
  transicion: "Ese cambio de estado no está permitido.",
  fechas: "La salida tiene que ser posterior al ingreso.",
  escritura: "No se pudo guardar. Revisá que la cuenta esté activa.",
};

export const STATUS_LABEL: Record<BookingStatus, string> = {
  provisional: "Provisional",
  confirmed: "Confirmada",
  checked_in: "Alojado",
  checked_out: "Finalizada",
  cancelled: "Cancelada",
  expired: "Vencida",
};

/** Cell colors of the occupancy grid; the legend reuses them. */
export const CELL_CLASS = {
  provisional: "bg-amber-200 text-amber-950 dark:bg-amber-900 dark:text-amber-50",
  confirmed: "bg-sky-200 text-sky-950 dark:bg-sky-900 dark:text-sky-50",
  checked_in: "bg-emerald-200 text-emerald-950 dark:bg-emerald-900 dark:text-emerald-50",
  checked_out: "bg-muted text-muted-foreground",
  block: "bg-zinc-300 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-50",
  cleaning: "bg-zinc-100 dark:bg-zinc-800",
} as const;

export function cellClass(status: BookingStatus, kind: "booking" | "block"): string {
  if (kind === "block") return CELL_CLASS.block;
  if (status === "provisional" || status === "confirmed" || status === "checked_in" || status === "checked_out") {
    return CELL_CLASS[status];
  }
  return "";
}

export function ReadOnlyNotice() {
  return (
    <Notice tone="warning">
      La cuenta está suspendida o vencida: el calendario queda en solo lectura y los datos se conservan.
    </Notice>
  );
}
