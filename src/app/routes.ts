import { Router } from "express";
import { healthRouter } from "../modules/health/health.route";
import { userRouter } from "../modules/user/user.route";
import { authRouter } from "../modules/auth/auth.route";
import { handoutRouter } from "../modules/handouts/handout.route";
import { quizRouter } from '../modules/ai-quiz/quiz.route';
import { topicReviewRouter } from '../modules/topic-review/topicReview.route';
import { pastQuizRouter } from "../modules/pastQuiz/pastQuiz.route";
import { contributionRouter } from "../modules/contribution/contribution.route";
import { feedbackRouter } from "../modules/feedback/feedback.route";
import { readinessRouter } from "../modules/readiness/readiness.route";
import { crashPlanRouter } from "../modules/crash-plan/crashPlan.route";
import { gdbRouter } from "../modules/gdb/gdb.route";
import { adminRouter } from "../modules/admin/admin.route";

export const routes = Router();

routes.use("/health", healthRouter);

routes.use("/user", userRouter);

routes.use("/auth", authRouter);

routes.use("/quiz", quizRouter);

routes.use("/topic-review", topicReviewRouter);

routes.use("/pastquiz", pastQuizRouter);

routes.use("/contributions", contributionRouter);

routes.use("/feedback", feedbackRouter);

routes.use("/readiness", readinessRouter);

routes.use("/crash-plan", crashPlanRouter);

routes.use("/gdb", gdbRouter);

routes.use("/handout", handoutRouter)

routes.use("/admin", adminRouter);


