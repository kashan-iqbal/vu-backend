import { z } from "zod";

// Grading one answer. The client sends the DISPLAY index it rendered — options are
// shuffled per attempt, so this means nothing without the attempt's stored order.
// Nothing here is scored; the server re-reads the answer from the database.
export const gradeAnswerSchema = z.object({
  attemptId: z.string().trim().min(1),
  id: z.number().int(),
  selectedOption: z.number().int().min(0),
});

// Submitting a finished attempt. The body names the attempt and nothing else —
// the score comes entirely from what the server recorded per answer.
export const submitAttemptSchema = z.object({
  attemptId: z.string().trim().min(1),
});

// LEGACY submit shape: the array of questions the old client posts back. Accepted
// so a quiz already open in a browser at deploy time can still be submitted.
// `correctAnswer` is deliberately absent — if an old client sends it, it is
// stripped here and re-read from the database rather than trusted.
const legacyQuizItemSchema = z
  .object({
    id: z.number(),
    selectedOption: z.number().int(),
    code: z.string().trim().min(1),
    type: z.string().trim().min(1),
  })
  .passthrough();

export const legacySubmitQuizSchema = z
  .array(legacyQuizItemSchema)
  .min(1, "No quiz data provided");

// One endpoint serves both shapes, so validation has to branch on the body.
export const submitQuizSchema = z.union([
  submitAttemptSchema,
  legacySubmitQuizSchema,
]);
