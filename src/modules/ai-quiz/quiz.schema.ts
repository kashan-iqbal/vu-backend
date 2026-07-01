import { z } from "zod";

// One answered question as submitted by the client. Shape-only validation —
// it guarantees clean primitives reach the DB (no injected objects) but does
// not re-grade; server-side scoring is tracked separately as a later item.
const quizItemSchema = z.object({
  id: z.number(),
  selectedOption: z.number().int(),
  correctAnswer: z.number().int(),
  code: z.string().trim().min(1),
  type: z.string().trim().min(1),
  topic_name: z.string().trim().min(1),
  question: z.string().optional(),
  options: z.array(z.string()).optional(),
});

export const submitQuizSchema = z
  .array(quizItemSchema)
  .min(1, "No quiz data provided");
