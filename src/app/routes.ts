import { Router } from "express";
import { healthRouter } from "../modules/health/health.route";
import { userRouter } from "../modules/user/user.route";
import { authRouter } from "../modules/auth/auth.route";
import { subjectRouter } from "../modules/subject/subject.route";
import { subscriptionRouter } from "../modules/subcription/subcription.route";
import { resultRouter } from "../modules/result/result.route";
import { mcqsRouter } from "../modules/mcqs/mcqs.route";
import { programRouter } from "../modules/programs/program.route";
import { handoutRouter } from "../modules/handouts/handout.route";
import AiRouter from "../modules/ai/ai.route";



export const routes = Router();


routes.use("/health", healthRouter);

routes.use("/user", userRouter);

routes.use("/auth", authRouter);

routes.use("/subjects", subjectRouter);

routes.use("/subscriptions", subscriptionRouter);

routes.use("/results", resultRouter);

routes.use("/mcqs", mcqsRouter);

routes.use("/program", programRouter)


routes.use("/handout", handoutRouter)


routes.use("/ai", AiRouter)
