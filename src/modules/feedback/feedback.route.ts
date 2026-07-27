import { Router } from "express";
import { submitFeedback } from "./feedback.controller";
import { authGuard } from "../../common/middlewares/auth.middleware";
import { feedbackLimiter } from "../../common/middlewares/rateLimit";
import { validate } from "../../common/middlewares/validate";
import { createFeedbackSchema } from "./feedback.schema";

export const feedbackRouter = Router();

// All feedback surfaces live behind login, so the endpoint requires auth and
// attaches the user automatically.
feedbackRouter.post(
  "/",
  authGuard,
  feedbackLimiter,
  validate(createFeedbackSchema),
  submitFeedback,
);
