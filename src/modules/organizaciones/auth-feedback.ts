import type { RegistrationResult } from "./registration-result";

type AuthErrorLike = { code?: string; status?: number };

const RATE_LIMIT_CODES = new Set(["over_request_rate_limit", "over_email_send_rate_limit"]);

// Message for a failed sign-in. Wrong email and wrong password share one message so the form does
// not reveal which accounts exist; the rate limit gets its own so the user knows to wait.
export function loginErrorMessage(error: AuthErrorLike): string {
  if (error.code === "email_not_confirmed") {
    return "Confirmá tu email antes de ingresar. Revisá tu bandeja de entrada.";
  }
  if (error.status === 429 || (error.code && RATE_LIMIT_CODES.has(error.code))) {
    return "Hubo demasiados intentos de ingreso. Esperá unos minutos y volvé a intentar.";
  }
  return "Email o contraseña incorrectos.";
}

// Where to go after `completePendingRegistration`: a failure lands on the panel, where the user
// can register the business again, with a notice explaining what happened.
export function registrationRedirect(result: RegistrationResult, next: string): string {
  if (result === "slug_taken") return "/panel?registro=direccion";
  if (result === "error") return "/panel?registro=error";
  return next;
}

const NOTICES: Record<string, string> = {
  direccion: "La dirección pública que elegiste al registrarte ya está en uso. Elegí otra para registrar tu negocio.",
  error: "No pudimos registrar tu negocio al confirmar tu cuenta. Intentá de nuevo desde este formulario.",
};

export function registrationNotice(value: string | undefined): string | null {
  return value && Object.hasOwn(NOTICES, value) ? NOTICES[value] : null;
}
