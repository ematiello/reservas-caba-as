// The database raises stable codes as the exception message (supabase/migrations/*_bookings.sql)
// and SQLSTATE 23P01 for the overlap constraint. This turns them into ?error= codes for the UI.

const BY_MESSAGE: Record<string, string> = {
  capacity_exceeded: "capacidad",
  no_unit_available: "sin_unidad",
  provisional_expired: "vencida",
  invalid_transition: "transicion",
  invalid_dates: "fechas",
};

export function bookingErrorCode(error: { code?: string; message?: string }): string {
  if (error.code === "23P01") return "superpuesta";
  return BY_MESSAGE[error.message ?? ""] ?? "escritura";
}
