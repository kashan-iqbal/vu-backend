import { z } from "zod";

// Text fields that accompany the uploaded PDF (multipart form fields). Validated
// after multer parses the body.
export const uploadPdfSchema = z.object({
  code: z.string().trim().min(1, "code is required"),
  courseTitle: z.string().trim().min(1, "courseTitle is required"),
  note: z.string().trim().max(500).optional(),
});
