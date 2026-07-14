import { Router } from "express";
import { GetSaveQuiz, SaveQuiz } from "./pastQuiz.controller";
import { authGuard } from "../../common/middlewares/auth.middleware";
import { requireApiKey } from "../../common/middlewares/apiKey";
import { validate } from "../../common/middlewares/validate";
import { importPastQuizSchema } from "./pastQuiz.schema";

export const pastQuizRouter = Router();

pastQuizRouter.post("/", requireApiKey, validate(importPastQuizSchema), SaveQuiz);

pastQuizRouter.get("/:code/:examtype", authGuard, GetSaveQuiz);

