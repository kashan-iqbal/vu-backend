import { z } from "zod";

export const createFeedbackSchema = z.object({
  rating: z.coerce.number().int().min(1, "Rating is required").max(5),
  comment: z.string().trim().max(1000).optional(),
  context: z.string().trim().max(50).optional(),
  reference: z.string().trim().max(100).optional(),
});

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;
