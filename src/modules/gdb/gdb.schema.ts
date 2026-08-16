import { z } from "zod";

export const gdbHelpSchema = z.object({
  // Real GDB/assignment prompts are substantial; a floor keeps junk out of the
  // shared cache, a ceiling caps token cost.
  question: z.string().trim().min(20, "Please paste the full GDB prompt (min 20 chars).").max(5000),
});
export type GdbHelpInput = z.infer<typeof gdbHelpSchema>;

export const gdbGrantSchema = z
  .object({
    userId: z.string().trim().optional(),
    email: z.string().trim().email().optional(),
    credits: z.coerce.number().int().optional(),
    passSemester: z.string().trim().max(20).optional(),
    passDays: z.coerce.number().int().min(1).max(365).optional(),
  })
  .refine((d) => d.userId || d.email, {
    message: "Provide a userId or email",
  })
  .refine((d) => d.credits !== undefined || (d.passSemester && d.passDays), {
    message: "Provide credits, or both passSemester and passDays",
  });
export type GdbGrantInput = z.infer<typeof gdbGrantSchema>;
