import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/modules/organizaciones/redirect";
import { completePendingRegistration } from "@/modules/organizaciones/registration";

// Only the email-confirmation flows are accepted here (not recovery or invites).
const OTP_TYPES = ["signup", "email"] as const;
type OtpType = (typeof OTP_TYPES)[number];

// Landing point of the confirmation email. Supports the PKCE link (?code=) used by the default
// Supabase template and the token-hash link (?token_hash=&type=) of customized templates.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type");

  const supabase = await createClient();
  let ok = false;

  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && OTP_TYPES.includes(type as OtpType)) {
    ok = !(await supabase.auth.verifyOtp({ type: type as OtpType, token_hash: tokenHash })).error;
  }

  if (!ok) redirect("/auth/login?error=confirmacion");

  await completePendingRegistration(supabase);
  redirect(safeNext(params.get("next")));
}
