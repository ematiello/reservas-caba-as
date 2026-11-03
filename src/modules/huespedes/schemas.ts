import { z } from "zod";

// Guest base (docs/01): minimal contact data, no ID document in the MVP. Same caps as the
// guests table checks.

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

export const guestSchema = z.object({
  guestId: z.uuid(),
  fullName: z.string().trim().min(1, "Ingresá el nombre.").max(120),
  phone: optional(40),
  email: optional(200).pipe(z.email("Email inválido.").nullable()),
  notes: z.string().trim().max(2000),
});

/**
 * A search box value safe to put in a PostgREST `or=(...ilike...)` filter: only letters, digits,
 * spaces and @ . + - survive (commas, parentheses and wildcards would change the filter).
 */
export function searchTerm(input: string | undefined): string {
  return (input ?? "")
    .replace(/[^\p{L}\p{N} @.+-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}
