import { Request, Response } from "express";
import { quizType } from "../ai-quiz/quiz.model";
import { getReadinessForCourse } from "./readiness.service";

const VALID_TYPES = Object.values(quizType) as string[];
const CODE_RE = /^[A-Z]{2,5}[0-9]{3}[A-Z]?$/;

// GET /readiness/:code/:examType — the student's readiness for one course exam.
export const getReadiness = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId?.toString();
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const code = String(req.params.code).toUpperCase();
    const type = String(req.params.examType).toLowerCase();

    if (!CODE_RE.test(code)) {
      return res.status(400).json({ message: "Invalid course code" });
    }
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ message: "Invalid exam type" });
    }

    const result = await getReadinessForCourse(userId, code, type, req.user);
    res.status(200).json(result);
  } catch {
    res.status(500).json({ message: "Error computing readiness" });
  }
};
