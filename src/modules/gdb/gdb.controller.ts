import { Request, Response } from "express";
import {
  generateGdbHelp,
  getGdbStatus,
  grantGdb,
  GdbUnavailableError,
} from "./gdb.service";
import { QueueFullError } from "./gdb.queue";
import type { GdbHelpInput, GdbGrantInput } from "./gdb.schema";

// POST /gdb/help — cache-check → charge → generate → store.
export const postGdbHelp = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId?.toString();
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { question } = req.body as GdbHelpInput;
    const result = await generateGdbHelp(userId, question);

    if (result.locked) {
      return res.status(402).json(result); // Payment Required — out of credits
    }
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof QueueFullError) {
      return res.status(503).json({ message: err.message });
    }
    if (err instanceof GdbUnavailableError) {
      return res.status(503).json({ message: err.message });
    }
    console.error("postGdbHelp error:", err);
    return res.status(500).json({ message: "Error generating GDB draft" });
  }
};

// GET /gdb/status — credit balance + pass state for the UI.
export const getGdbStatusController = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId?.toString();
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const status = await getGdbStatus(userId);
    return res.status(200).json(status);
  } catch (err) {
    console.error("getGdbStatus error:", err);
    return res.status(500).json({ message: "Error loading GDB status" });
  }
};

// POST /gdb/grant — admin-only top-up of credits / semester pass.
export const grantGdbController = async (req: Request, res: Response) => {
  try {
    const result = await grantGdb(req.body as GdbGrantInput);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({ message: (err as Error).message });
  }
};
