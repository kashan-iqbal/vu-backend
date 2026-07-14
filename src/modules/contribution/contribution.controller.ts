import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { isR2Configured } from "../../config/r2";
import * as contributionService from "./contribution.service";
import { contributionCodeSchema } from "./contribution.schema";

// GET /contributions/codes — the course codes that already have a PDF.
export const getCodes = async (_req: Request, res: Response) => {
  try {
    const codes = await contributionService.getUploadedCodes();
    res.status(200).json(codes);
  } catch {
    res.status(500).json({ message: "Error fetching uploaded codes" });
  }
};

// POST /contributions/:code — store one PDF per course code (first upload wins).
export const uploadContribution = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId?.toString();
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const parsedCode = contributionCodeSchema.safeParse(req.params.code);
    if (!parsedCode.success) {
      return res.status(400).json({ message: "Invalid course code" });
    }
    const code = parsedCode.data;

    if (!isR2Configured()) {
      return res
        .status(503)
        .json({ message: "Uploads are not configured yet. Please try later." });
    }

    if (!req.file) {
      return res.status(400).json({ message: "A PDF file is required" });
    }

    if (await contributionService.codeIsTaken(code)) {
      return res
        .status(409)
        .json({ message: "This course already has an uploaded PDF." });
    }

    const uniqueId = uuidv4();
    const r2Key = contributionService.buildObjectKey(code, uniqueId);

    await contributionService.putObjectToR2(
      r2Key,
      req.file.buffer,
      req.file.mimetype,
    );

    try {
      await contributionService.createContribution({
        code,
        user: userId,
        uniqueId,
        r2Key,
        originalName: req.file.originalname,
        size: req.file.size,
        contentType: req.file.mimetype,
        note: req.body?.note,
      });
    } catch (err) {
      // Lost a race for this code: the unique index rejected the insert after we
      // already stored the object, so drop the now-orphaned upload.
      if ((err as { code?: number })?.code === 11000) {
        await contributionService.deleteObjectFromR2(r2Key);
        return res
          .status(409)
          .json({ message: "This course already has an uploaded PDF." });
      }
      throw err;
    }

    res.status(201).json({
      success: true,
      message: "PDF uploaded. Thank you for contributing!",
    });
  } catch {
    res.status(500).json({ message: "Error uploading PDF" });
  }
};
