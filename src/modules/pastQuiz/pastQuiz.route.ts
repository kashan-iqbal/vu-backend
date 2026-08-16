import { Router } from "express";
import { GetSaveQuiz, ListPastQuizKeys, SaveQuiz } from "./pastQuiz.controller";
import { requireApiKey } from "../../common/middlewares/apiKey";
import { validate } from "../../common/middlewares/validate";
import { importPastQuizSchema } from "./pastQuiz.schema";

export const pastQuizRouter = Router();

pastQuizRouter.post("/", requireApiKey, validate(importPastQuizSchema), SaveQuiz);

// List of { code, examType, count } pairs that have past MCQs (for SSG params +
// sitemap). Public — exposes only codes/types/counts, no question content.
pastQuizRouter.get("/", ListPastQuizKeys);

// Public: the past-paper MCQs for a course are now published on indexable
// /past-papers pages, so the read endpoint that feeds them is public too (it was
// authGuard-gated when the content was only shown behind login). The write
// (POST) stays x-api-key-gated.
pastQuizRouter.get("/:code/:examtype", GetSaveQuiz);

