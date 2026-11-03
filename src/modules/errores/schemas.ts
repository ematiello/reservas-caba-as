import { z } from "zod";

// Shared by the browser error boundaries and the server action that receives their report.
export const browserReportSchema = z.object({
  message: z.string().min(1).max(500),
  digest: z.string().max(100).nullish(),
  route: z.string().max(200).startsWith("/"),
});
