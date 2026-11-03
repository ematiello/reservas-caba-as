import "server-only";

import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export type ErrorLogRow = Database["public"]["Tables"]["error_log"]["Row"];

export const ERRORS_PAGE = 50;
export const ERROR_FILTERS = ["open", "resolved", "ignored", "all"] as const;
export type ErrorFilter = (typeof ERROR_FILTERS)[number];

/** ?estado= to a filter; the open errors are what the admin came to see. */
export function filterFrom(value: string | string[] | undefined): ErrorFilter {
  return ERROR_FILTERS.find((f) => f === value) ?? "open";
}

/** ?pagina= (1-based) to a non-negative offset. */
export function offsetFrom(value: string | string[] | undefined): number {
  const page = typeof value === "string" && /^\d{1,4}$/.test(value) ? Number(value) : 1;
  return (Math.max(page, 1) - 1) * ERRORS_PAGE;
}

/**
 * The error log, most recent first. Row level security lets only the platform admin read it; one
 * extra row tells whether there is a next page.
 */
export async function listErrors(filter: ErrorFilter, offset: number): Promise<{ rows: ErrorLogRow[]; hasMore: boolean }> {
  const supabase = await createClient();
  let query = supabase.from("error_log").select("*").order("last_at", { ascending: false }).order("id", { ascending: false });
  if (filter !== "all") query = query.eq("status", filter);
  const { data, error } = await query.range(offset, offset + ERRORS_PAGE);
  if (error) throw new Error("Could not load the error log");
  return { rows: data.slice(0, ERRORS_PAGE), hasMore: data.length > ERRORS_PAGE };
}

/** Open errors, for the summary in the page title. */
export async function countOpenErrors(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase.from("error_log").select("id", { count: "exact", head: true }).eq("status", "open");
  if (error) throw new Error("Could not count the open errors");
  return count ?? 0;
}
