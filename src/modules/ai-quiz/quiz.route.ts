import { Router } from "express";
import {
    getSmartQuiz,
    SubmitQuizResult,
    GradeQuizAnswer,
} from "./quiz.controller";
import { authGuard } from "../../common/middlewares/auth.middleware";
import { validate } from "../../common/middlewares/validate";
import { submitQuizSchema, gradeAnswerSchema } from "./quiz.schema";

export const quizRouter = Router();

quizRouter.get("/:quizCode", authGuard, getSmartQuiz);

// Per-answer grading. Called once per question as the student answers, which is
// what replaces shipping `correctAnswer` to the browser up front.
quizRouter.post(
    "/answer",
    authGuard,
    validate(gradeAnswerSchema),
    GradeQuizAnswer,
);

quizRouter.post("/submitQuiz", authGuard, validate(submitQuizSchema), SubmitQuizResult);
