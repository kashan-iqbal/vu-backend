import { Request, Response } from "express";
import * as feedbackService from "./feedback.service";

// POST /feedback — record a rating (+ optional comment) from the logged-in user.
// The body is already validated by validate(createFeedbackSchema).
export const submitFeedback = async (req: Request, res: Response) => {
  try {
    const { rating, comment, context, reference } = req.body;

    await feedbackService.createFeedback({
      rating,
      comment,
      context,
      reference,
      user: req.user?.userId?.toString(),
    });

    res.status(201).json({
      success: true,
      message: "Thanks for your feedback!",
    });
  } catch {
    res.status(500).json({ message: "Error saving feedback" });
  }
};
