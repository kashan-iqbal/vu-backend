import { Router } from "express";
import { getTopicReview } from "./topicReview.controller";
import { authGuard } from "../../common/middlewares/auth.middleware";

export const topicReviewRouter = Router();

// GET /api/v1/topic-review/:quizCode  (e.g. finalterm-CS101)
topicReviewRouter.get("/:quizCode", authGuard, getTopicReview);
