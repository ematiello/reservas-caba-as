export type ActionResult = { ok: string } | { error: string };

/** The page a server action returns to, with the ?ok= / ?error= code the page turns into a message. */
export function resultUrl(path: string, result: ActionResult): string {
  return `${path}?${"ok" in result ? `ok=${result.ok}` : `error=${result.error}`}`;
}
