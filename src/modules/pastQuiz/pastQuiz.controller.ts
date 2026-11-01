import { Request, Response } from "express";
import * as pastQuizService from "./pastQuiz.service";
import { requestFrontendRebuild } from "../../common/utils/deployHook";



export const SaveQuiz = async (req: Request, res: Response) => {
  try {
    const result = await pastQuizService.bulkUpsertPastQuiz(req.body);

    // /past-papers pages are statically generated with dynamicParams = false, and
    // the 5-MCQ count gate means an import can make a NEW pair publishable — so
    // the URL set changes and the frontend has to rebuild. Debounced.
    requestFrontendRebuild("pastquiz:bulk-import");

    res.status(200).json({ message: "Bulk import successful", ...result });
  } catch (error) {
    res.status(500).json({ message: "Error importing past quizzes", error });
  }
}



export const GetSaveQuiz = async (req: Request, res: Response) => {
  try {
    const { code, examtype } = req.params;
    const quizzes = await pastQuizService.getPastQuizByCodeAndType(code, examtype);
    res.status(200).json(quizzes);
  } catch (error) {
    res.status(500).json({ message: "Error fetching past quizzes", error });
  }
}

// GET /pastquiz  → [{ code, examType, count }] — public list of pairs that have
// past-paper MCQs, for the /past-papers SSG pages + sitemap. Only exposes course
// codes / exam types / counts (no question content), like the handout list.
export const ListPastQuizKeys = async (_req: Request, res: Response) => {
  try {
    // Gate thin pages: only publish a past-papers page with enough real MCQs.
    const keys = await pastQuizService.getPastQuizKeys(5);
    res.status(200).json(keys);
  } catch (error) {
    res.status(500).json({ message: "Error listing past quizzes", error });
  }
}