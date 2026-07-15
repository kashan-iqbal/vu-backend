import { Router } from "express";
import { getCodes, uploadContribution } from "./contribution.controller";
import { uploadLimiter } from "../../common/middlewares/rateLimit";
import { pdfUpload50 } from "../../common/middlewares/pdfUpload";
import { validate } from "../../common/middlewares/validate";
import { contributionBodySchema } from "./contribution.schema";

export const contributionRouter = Router();

// Both routes are intentionally PUBLIC: requiring a login to contribute a course
// PDF suppressed participation. Abuse is bounded by the allowlist in
// contribution.codes.ts (caps the bucket at one object per known course) plus
// uploadLimiter, rather than by authentication.
contributionRouter.get("/codes", getCodes);

// pdfUpload50 must run before validate(): multer is what parses the multipart
// body, so name/phone/note don't exist on req.body until after it.
contributionRouter.post(
  "/:code",
  uploadLimiter,
  pdfUpload50,
  validate(contributionBodySchema),
  uploadContribution,
);
