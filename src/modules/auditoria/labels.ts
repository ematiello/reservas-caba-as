// Plain-language description of an audit_log row (what changed, in the words of the panel).
// Pure: the pages render it, the tests pin it.

export type AuditRow = {
  action: string;
  table_name: string;
  diff: unknown;
};

const NOUN: Record<string, string> = {
  organizations: "organización",
  memberships: "integrante",
  invitations: "invitación",
  plans: "plan",
  platform_settings: "ajustes de la plataforma",
  subscriptions: "suscripción",
  subscription_payments: "pago de suscripción",
  amenities: "comodidad",
  properties: "establecimiento",
  units: "unidad",
  unit_categories: "categoría",
  bookings: "reserva o bloqueo",
  guests: "huésped",
  holidays: "feriado",
  rate_rules: "tarifa",
  length_discounts: "descuento por estadía",
  booking_payments: "pago de huésped",
  platform_admins: "administrador de la plataforma",
};

const VIEWED: Record<string, string> = {
  bookings: "La plataforma consultó las reservas",
  guests: "La plataforma consultó los huéspedes",
};

const FIELD: Record<string, string> = {
  name: "nombre",
  slug: "dirección",
  status: "estado",
  disabled_at: "desactivada",
  plan_id: "plan",
  grace_days: "días de gracia",
  current_period_start: "inicio del período",
  current_period_end: "fin del período",
  role: "rol",
  revoked_at: "revocada",
  is_published: "publicado",
  price_cents: "precio",
  check_in: "ingreso",
  check_out: "salida",
  voided_at: "anulado",
  date: "fecha",
  full_name: "nombre",
};

// Bookkeeping columns that change on every update and say nothing to a reader.
const NOISE = new Set(["updated_at", "created_at", "occupied"]);

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function show(value: unknown): string {
  if (value === null || value === undefined) return "vacío";
  if (typeof value === "boolean") return value ? "sí" : "no";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "…";
}

/** Changed fields of an update, as "estado: trial → cancelled", noise left out, at most `max`. */
export function changedFields(diff: unknown, max = 4): string[] {
  const d = record(diff);
  const before = record(d?.old);
  const after = record(d?.new);
  if (!before || !after) return [];
  const changes = Object.keys(after)
    .filter((key) => !NOISE.has(key) && JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((key) => `${FIELD[key] ?? key}: ${show(before[key])} → ${show(after[key])}`);
  return changes.length > max ? [...changes.slice(0, max), `y ${changes.length - max} más`] : changes;
}

/** What the row is about: its name, its date, or nothing. */
function subject(diff: unknown): string | null {
  const d = record(diff);
  const row = record(d?.new) ?? record(d?.old);
  if (!row) return null;
  for (const key of ["name", "full_name", "date", "check_in"]) {
    if (typeof row[key] === "string" && row[key]) return row[key] as string;
  }
  return null;
}

export function describeAudit(row: AuditRow): { title: string; detail: string | null } {
  if (row.action === "view") return { title: VIEWED[row.table_name] ?? "Consulta de la plataforma", detail: null };
  const noun = NOUN[row.table_name] ?? row.table_name;
  const verb = { insert: "Alta de", update: "Cambio en", delete: "Baja de" }[row.action] ?? capitalize(row.action);
  const title = `${verb} ${noun}`;
  if (row.action === "update") {
    const changes = changedFields(row.diff);
    return { title, detail: changes.length ? changes.join(" · ") : null };
  }
  return { title, detail: subject(row.diff) };
}
