import { z } from "zod";
import { ExamType } from "./handout.model";

export const createHandoutSchema = z.object({
  code: z.string().trim().min(1, "code is required"),
  examType: z.nativeEnum(ExamType),
  content: z.string().min(1, "content is required"),
});
