import { z } from "zod";

export const createCrashPlanSchema = z.object({
  // Hours until the exam. 1..168 (up to a week) — cramming beyond that isn't "crash".
  hoursAvailable: z.coerce.number().int().min(1).max(168),
});

export type CreateCrashPlanInput = z.infer<typeof createCrashPlanSchema>;
