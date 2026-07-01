import { Request, Response } from "express";
import { getHandout, listHandoutKeys, upsertHandout } from "./handout.service";
import { ExamType } from "./handout.model";

const VALID_EXAM_TYPES = Object.values(ExamType) as string[];

// GET /handout  → [{ code, examType }]  (for SSG generateStaticParams)
export async function listHandoutsController(_req: Request, res: Response) {
  try {
    const handouts = await listHandoutKeys();
    return res.json(handouts);
  } catch (error) {
    console.error("listHandouts error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

// GET /handout/:code/:examType  → { code, examType, content }
export async function getSingleHandout(req: Request, res: Response) {
  try {
    const { code, examType } = req.params;
    if (!VALID_EXAM_TYPES.includes(examType)) {
      return res.status(400).json({ message: "Invalid exam type" });
    }

    const handout = await getHandout(code, examType);
    if (!handout) {
      return res.status(404).json({ message: "Handout not found" });
    }

    return res.json(handout);
  } catch (error) {
    console.error("getHandout error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

// POST /handout  { code, examType, content }  → upsert (script / admin)
export async function createHandoutsController(req: Request, res: Response) {
  try {
    const { code, examType, content } = req.body;
    if (!code || !examType || !content) {
      return res
        .status(400)
        .json({ message: "code, examType and content are required" });
    }

    if (!VALID_EXAM_TYPES.includes(examType)) {
      return res.status(400).json({ message: "Invalid exam type" });
    }

    console.log("createHandout:", { code, examType, contentLength: content.length });

    const result = await upsertHandout(code, examType, content);
    return res.status(201).json(result);
  } catch (error) {
    console.error("createHandout error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
