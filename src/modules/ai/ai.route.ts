import { Router } from "express";
import {
  GenerateQuizController,
  streamChatWithDocController,
  streamSummaryController,
  SubmitQuizController,
  topicExplainationController,
  upload,
  uploadHandoutController,
} from "./ai.controller";

const AiRouter = Router();

// Upload PDF → ingest vectors
AiRouter.post("/upload", upload.single("file"), uploadHandoutController);

AiRouter.post("/chat-doc/stream", streamChatWithDocController);

// // Stream summary (SSE)
AiRouter.get("/summary/stream", streamSummaryController);

// // Topic quiz
AiRouter.post("/quizzes", GenerateQuizController);
AiRouter.post("/quiz/topic/submit", SubmitQuizController);

// // Stream reteach (SSE)
AiRouter.get("/topic/explaination", topicExplainationController);

export default AiRouter;
