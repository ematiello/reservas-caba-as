// Only the email-confirmation flows are accepted (not recovery or invites).
const OTP_TYPES = ["signup", "email"] as const;
export type EmailOtpType = (typeof OTP_TYPES)[number];

const TOKEN_HASH = /^[A-Za-z0-9_-]{16,256}$/;

export function parseEmailConfirmation(
  tokenHash: string | null | undefined,
  type: string | null | undefined,
): { tokenHash: string; type: EmailOtpType } | null {
  if (!tokenHash || !TOKEN_HASH.test(tokenHash)) return null;
  const otpType = OTP_TYPES.find((t) => t === type);
  return otpType ? { tokenHash, type: otpType } : null;
}
