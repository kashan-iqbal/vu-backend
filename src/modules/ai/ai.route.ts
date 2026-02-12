// ============================================
// AI Routes (Refactored & Production-Ready)
// ============================================

import { Router } from "express";
import multer from "multer";
import {
  uploadHandoutController,
  streamChatWithDocController,
  streamSummaryController,
  generateQuizController,
  submitQuizController,
  topicExplanationController,
  vuAssistantController,
} from "./ai.controller";
import {
  validateUploadRequest,
  validateStreamChatRequest,
  validateSubmitQuizRequest,
} from "./validation.middleware";
import { asyncHandler } from "./error.middleware";

// ============================================
// Multer Configuration
// ============================================

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

// ============================================
// Router Setup
// ============================================

const aiRouter = Router();

// ============================================
// Routes
// ============================================

/**
 * POST /ai/upload
 * Upload PDF and create vector embeddings
 * 
 * Body (multipart/form-data):
 * - file: PDF file
 * - courseId: string
 * - userId: string
 * - code: string (subject code)
 */
aiRouter.post(
  "/upload",
  upload.single("file"),
  validateUploadRequest,
  asyncHandler(uploadHandoutController)
);

/**
 * POST /ai/chat-doc/stream
 * Stream chat responses based on query type
 * 
 * Body (application/json):
 * - userId: string
 * - courseId: string
 * - message: string (required for GENERAL queries)
 * - queryType: "GENERAL" | "GEN_QUIZ" | "QUIZ_CHECK" | "WEAK_TOPIC_TEACH"
 * - body: any (optional, used for QUIZ_CHECK and WEAK_TOPIC_TEACH)
 * - code: string (subject code)
 * - chatHistory: array (optional, for future use)
 */
aiRouter.post(
  "/chat-doc/stream",
  validateStreamChatRequest,
  streamChatWithDocController
);



aiRouter.post(
  "/vu-assistant",
  vuAssistantController
);

/**
 * GET /ai/summary/stream
 * Stream document summary
 * 
 * Query params:
 * - userId: string
 * - courseId: string
 * - code: string (subject code)
 */
aiRouter.get(
  "/summary/stream",
  asyncHandler(streamSummaryController)
);

/**
 * POST /ai/quizzes
 * Generate quiz (non-streaming, legacy endpoint)
 * 
 * Body (application/json):
 * - userId: string
 * - courseId: string
 * - code: string
 */
aiRouter.post(
  "/quizzes",
  asyncHandler(generateQuizController)
);

/**
 * POST /ai/quiz/topic/submit
 * Submit quiz answers and get score
 * 
 * Body (application/json):
 * - quiz: array of { question: string, selected: string }
 * - mcqs: array of { question: string, options: string[], correctAnswer: string, reason: string }
 */
aiRouter.post(
  "/quiz/topic/submit",
  validateSubmitQuizRequest,
  asyncHandler(submitQuizController)
);

/**
 * POST /ai/topic/explanation
 * Get explanation for a specific topic
 * 
 * Body (application/json):
 * - userId: string
 * - courseId: string
 * - topic: string
 * - code: string
 */
aiRouter.post(
  "/topic/explanation",
  asyncHandler(topicExplanationController)
);

export default aiRouter;