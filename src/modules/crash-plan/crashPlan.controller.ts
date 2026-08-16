import { Request, Response } from "express";
import { quizType } from "../ai-quiz/quiz.model";
import { generateAndSave, getSaved } from "./crashPlan.service";

const VALID_TYPES = Object.values(quizType) as string[];
const CODE_RE = /^[A-Z]{2,5}[0-9]{3}[A-Z]?$/;

// Validate the shared path params, returning the cleaned values or null (+ 4xx sent).
function parseParams(req: Request, res: Response) {
  const userId = req.user?.userId?.toString();
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }
  const code = String(req.params.code).toUpperCase();
  const type = String(req.params.examType).toLowerCase();
  if (!CODE_RE.test(code)) {
    res.status(400).json({ message: "Invalid course code" });
    return null;
  }
  if (!VALID_TYPES.includes(type)) {
    res.status(400).json({ message: "Invalid exam type" });
    return null;
  }
  return { userId, code, type };
}

// POST /crash-plan/:code/:examType — generate (or regenerate) and persist a plan.
export const createCrashPlan = async (req: Request, res: Response) => {
  try {
    const parsed = parseParams(req, res);
    if (!parsed) return;
    const { hoursAvailable } = req.body as { hoursAvailable: number };

    const result = await generateAndSave(
      parsed.userId,
      parsed.code,
      parsed.type,
      hoursAvailable,
      req.user,
    );
    res.status(200).json(result);
  } catch {
    res.status(500).json({ message: "Error generating crash plan" });
  }
};

// GET /crash-plan/:code/:examType — fetch the saved plan (exists:false if none).
export const getCrashPlan = async (req: Request, res: Response) => {
  try {
    const parsed = parseParams(req, res);
    if (!parsed) return;

    const result = await getSaved(
      parsed.userId,
      parsed.code,
      parsed.type,
      req.user,
    );
    res.status(200).json(result);
  } catch {
    res.status(500).json({ message: "Error loading crash plan" });
  }
};
