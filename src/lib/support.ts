// Pilot support channel: testers write here when something fails (e.g. a schedule won't save).
// wa.me wants the full international number with digits only.
export const SUPPORT_WHATSAPP = "5493549503747";

export const SUPPORT_MESSAGE = "Hola, necesito ayuda con Reservas Traslasierra.";

export function supportHref(): string {
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(SUPPORT_MESSAGE)}`;
}
