// ============================================
// Request Validation Middleware
// ============================================

import { Request, Response, NextFunction } from "express";
import { ValidationError } from "./ai.types";

/**
 * Validate upload handout request
 */
export function validateUploadRequest(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { courseId, userId, code } = req.body;
    const file = (req as any).file;

    if (!file) {
      throw new ValidationError("PDF file is required");
    }

    if (!courseId || typeof courseId !== "string") {
      throw new ValidationError("courseId is required and must be a string");
    }

    if (!userId || typeof userId !== "string") {
      throw new ValidationError("userId is required and must be a string");
    }

    if (!code || typeof code !== "string") {
      throw new ValidationError("code is required and must be a string");
    }

    // Validate file type
    if (!file.mimetype || file.mimetype !== "application/pdf") {
      throw new ValidationError("Only PDF files are allowed");
    }

    // Validate file size (25MB limit)
    const MAX_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      throw new ValidationError("File size must be less than 25MB");
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Validate stream chat request
 */
export function validateStreamChatRequest(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { userId, courseId, message, queryType, code } = req.body;


    if (!userId || typeof userId !== "string") {
      throw new ValidationError("userId is required and must be a string");
    }

    if (!courseId || typeof courseId !== "string") {
      throw new ValidationError("courseId is required and must be a string");
    }

    if (!code || typeof code !== "string") {
      throw new ValidationError("code is required and must be a string");
    }

    if (!queryType || typeof queryType !== "string") {
      throw new ValidationError("queryType is required and must be a string");
    }

    const validQueryTypes = ["GENERAL", "GEN_QUIZ", "QUIZ_CHECK", "WEAK_TOPIC_TEACH", "EXAM_STAGE"];
    if (!validQueryTypes.includes(queryType)) {
      throw new ValidationError(
        `queryType must be one of: ${validQueryTypes.join(", ")}`
      );
    }

    // Message is required for GENERAL queries
    if (queryType === "GENERAL" && (!message || typeof message !== "string")) {
      throw new ValidationError("message is required for GENERAL queries");
    }

    // Body is required for QUIZ_CHECK
    if (queryType === "QUIZ_CHECK" && !req.body.body) {
      throw new ValidationError("body is required for QUIZ_CHECK queries");
    }

    next();
  } catch (error) {
    console.log(error)
    next(error);
  }
}

/**
 * Validate submit quiz request
 */
export function validateSubmitQuizRequest(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { quiz, mcqs } = req.body;

    if (!quiz || !Array.isArray(quiz)) {
      throw new ValidationError("quiz is required and must be an array");
    }

    if (!mcqs || !Array.isArray(mcqs)) {
      throw new ValidationError("mcqs is required and must be an array");
    }

    if (quiz.length === 0) {
      throw new ValidationError("quiz array cannot be empty");
    }

    if (mcqs.length === 0) {
      throw new ValidationError("mcqs array cannot be empty");
    }

    // Validate quiz answer structure
    quiz.forEach((answer: any, index: number) => {
      if (!answer.question || typeof answer.question !== "string") {
        throw new ValidationError(
          `quiz[${index}].question is required and must be a string`
        );
      }
      if (!answer.selected || typeof answer.selected !== "string") {
        throw new ValidationError(
          `quiz[${index}].selected is required and must be a string`
        );
      }
    });

    // Validate MCQ structure
    mcqs.forEach((mcq: any, index: number) => {
      if (!mcq.question || typeof mcq.question !== "string") {
        throw new ValidationError(
          `mcqs[${index}].question is required and must be a string`
        );
      }
      if (!mcq.correctAnswer || typeof mcq.correctAnswer !== "string") {
        throw new ValidationError(
          `mcqs[${index}].correctAnswer is required and must be a string`
        );
      }
      if (!mcq.options || !Array.isArray(mcq.options) || mcq.options.length !== 4) {
        throw new ValidationError(
          `mcqs[${index}].options must be an array of 4 strings`
        );
      }
    });

    next();
  } catch (error) {
    next(error);
  }
}