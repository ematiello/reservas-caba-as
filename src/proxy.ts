import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

// Only private and auth areas need a fresh session; public pages stay cacheable.
export const config = {
  matcher: ["/panel/:path*", "/admin/:path*", "/auth/:path*"],
};
