import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { registrationRedirect } from "@/modules/organizaciones/auth-feedback";
import { parseEmailConfirmation } from "@/modules/organizaciones/email-confirmation";
import { safeNext } from "@/modules/organizaciones/redirect";
import { completePendingRegistration } from "@/modules/organizaciones/registration";

// Landing point of the confirmation email.
// - PKCE link (?code=), used by the default Supabase template: exchanged here. Only the browser that
//   signed up holds the code verifier cookie, so a link scanner cannot use the code.
// - Token-hash link (?token_hash=&type=) of customized templates: never verified on a GET, because a
//   mail scanner opening the link would consume the token. It goes to /auth/confirmar, where the
//   user confirms with a POST.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNext(params.get("next"));
  const code = params.get("code");

  if (!code) {
    const confirmation = parseEmailConfirmation(params.get("token_hash"), params.get("type"));
    if (!confirmation) redirect("/auth/login?error=confirmacion");
    const query = new URLSearchParams({ token_hash: confirmation.tokenHash, type: confirmation.type, next });
    redirect(`/auth/confirmar?${query}`);
  }

  const supabase = await createClient();
  if ((await supabase.auth.exchangeCodeForSession(code)).error) redirect("/auth/login?error=confirmacion");

  const registration = await completePendingRegistration(supabase);
  redirect(registrationRedirect(registration, next));
}
