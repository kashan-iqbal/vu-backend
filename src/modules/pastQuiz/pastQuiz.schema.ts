import { z } from "zod";

export const pastQuizItemSchema = z
  .object({
    id: z.number().int().positive(),
    question: z.string().trim().min(1),
    type: z.enum(["midterm", "finalterm"]),
    code: z.string().trim().toUpperCase(),
    options: z.array(z.string().trim().min(1)).min(2).max(4),
    correctAnswer: z.number().int().min(0).max(3),
    generated: z.boolean().optional().default(false),
  })
  // correctAnswer must point at an existing option.
  .refine((q) => q.correctAnswer < q.options.length, {
    message: "correctAnswer must be a valid index into options",
    path: ["correctAnswer"],
  });

export const importPastQuizSchema = z.array(pastQuizItemSchema);

export const pastQuizParamsSchema = z.object({
  code: z.string().trim().toUpperCase(),
  examtype: z.enum(["midterm", "finalterm"]),
});
