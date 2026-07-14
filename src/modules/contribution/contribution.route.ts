import { Router } from "express";
import { getCodes, uploadContribution } from "./contribution.controller";
import { authGuard } from "../../common/middlewares/auth.middleware";
import { uploadLimiter } from "../../common/middlewares/rateLimit";
import { pdfUpload50 } from "../../common/middlewares/pdfUpload";
import { validate } from "../../common/middlewares/validate";
import { contributionBodySchema } from "./contribution.schema";

export const contributionRouter = Router();

contributionRouter.get("/codes", authGuard, getCodes);

// pdfUpload50 must run before validate(): multer is what parses the multipart
// body, so `note` doesn't exist on req.body until after it.
contributionRouter.post(
  "/:code",
  authGuard,
  uploadLimiter,
  pdfUpload50,
  validate(contributionBodySchema),
  uploadContribution,
);
