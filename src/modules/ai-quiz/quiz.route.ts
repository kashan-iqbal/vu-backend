import { Router } from "express";
import { getSmartQuiz, SubmitQuizResult } from "./quiz.controller";
import { authGuard } from "../../common/middlewares/auth.middleware";
import { validate } from "../../common/middlewares/validate";
import { submitQuizSchema } from "./quiz.schema";

export const quizRouter = Router();

quizRouter.get("/:quizCode", authGuard, getSmartQuiz);

quizRouter.post("/submitQuiz", authGuard, validate(submitQuizSchema), SubmitQuizResult);
