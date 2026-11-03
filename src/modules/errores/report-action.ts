"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import { logError } from "./log";
import { browserReportSchema } from "./schemas";

// Public on purpose: the error screen can appear to a visitor who is not signed in. The payload is
// validated and bounded, the text is sanitized in logError, and the database caps how many new browser
// errors can be created per hour. The signed-in user, when there is one, comes from the session and
// never from the payload.
export async function reportBrowserErrorAction(input: z.input<typeof browserReportSchema>): Promise<void> {
  const parsed = browserReportSchema.safeParse(input);
  if (!parsed.success) return;
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  } catch {
    // An error screen must still be reported when the session cannot be read.
  }
  await logError({
    source: "browser",
    message: parsed.data.message,
    digest: parsed.data.digest,
    route: parsed.data.route,
    userId,
  });
}
