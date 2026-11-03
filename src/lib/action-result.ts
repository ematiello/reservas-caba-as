import "server-only";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";

import { resultUrl, type ActionResult } from "./action-result-url";

/**
 * Ends a server action: refreshes the page (and any cache tags it names) and sends the user back
 * with the result code. Shared by the actions that answer with ?ok= / ?error=.
 */
export function done(path: string, result: ActionResult, options: { tags?: string[] } = {}): never {
  revalidatePath(path);
  for (const tag of options.tags ?? []) updateTag(tag);
  redirect(resultUrl(path, result));
}
