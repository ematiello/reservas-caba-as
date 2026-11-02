import { messageFor, Notice } from "@/components/shell/notice";
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
  estadia_minima: "Las tarifas de esas fechas piden una estadía más larga.",
  precio: "Precio calculado y congelado.",
  sin_tarifa: "Falta tarifa para alguna noche: cargá una tarifa base en el establecimiento.",
  pago: "Pago registrado.",
  devolucion: "Devolución registrada.",
  anulado: "Pago anulado: ya no cuenta para el saldo.",
  sena: "Seña actualizada.",
  pago_invalido: "Revisá el pago: importe mayor a cero, fecha válida, concepto y medio.",
  pago_rechazado: "No se pudo registrar el pago (las devoluciones las registra el propietario o un administrador).",
  anulacion_rechazada: "No se pudo anular: solo el propietario o un administrador, y una sola vez.",
  sin_permiso: "Solo el propietario o un administrador pueden hacer eso.",
  sena_invalida: "La seña tiene que ser un importe entre cero y el total de la reserva.",
  precio_pendiente: "La reserva se actualizó, pero su precio no se pudo recalcular: revisalo antes de cobrar.",
  minimo_sin_anular:
    "Las tarifas de la unidad asignada piden una estadía más larga y la reserva no se pudo anular sola: anulala desde acá.",
};

/** The ?ok= / ?error= message; the minimum stay carries the required nights in ?minimo=. */
export function bookingMessage(query: Record<string, string | string[] | undefined>) {
  const minimo = typeof query.minimo === "string" && /^\d+$/.test(query.minimo) ? query.minimo : null;
  if (query.error === "estadia_minima" && minimo) {
    return { tone: "error" as const, text: `Las tarifas de esas fechas piden una estadía mínima de ${minimo} noches.` };
  }
  return messageFor(query, MESSAGES);
}

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
  provisional: "bg-status-provisional text-status-provisional-ink",
  confirmed: "bg-status-confirmed text-brand-green-deep",
  checked_in: "bg-brand-green text-white",
  checked_out: "bg-muted text-muted-foreground",
  block: "bg-status-block text-brand-slate",
  cleaning: "bg-[repeating-linear-gradient(135deg,var(--brand-sand)_0_5px,var(--status-cleaning-line)_5px_7px)]",
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
