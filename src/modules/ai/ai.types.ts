// ============================================
// Backend AI Types (Frontend Compatible)
// ============================================

export type QueryType = "GENERAL" | "GEN_QUIZ" | "QUIZ_CHECK" | "WEAK_TOPIC_TEACH";

export type ChatStage =
  | "UPLOAD"
  | "SUMMARY"
  | "CHAT"
  | "QUIZ"
  | "WEAK_TOPICS";

// ============================================
// Request Types
// ============================================

export interface UploadHandoutRequest {
  courseId: string;
  userId: string;
  code: string;
  file: Express.Multer.File;
}

export interface StreamChatRequest {
  userId: string;
  courseId: string;
  message: string;
  queryType: QueryType;
  body?: any;
  code: string;
  chatHistory?: any[]; // Future: typed chat history
}

export interface GenerateQuizRequest {
  userId: string;
  courseId: string;
  code: string;
}

export interface SubmitQuizRequest {
  quiz: QuizAnswer[];
  mcqs: QuizQuestion[];
}

// ============================================
// Response Types
// ============================================

export interface UploadHandoutResponse {
  success: boolean;
  message: string;
  hasEmbedding?: boolean;
  courseId?: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  reason: string;
}

export interface QuizAnswer {
  question: string;
  selected: string;
}

export interface QuizResult {
  question: string;
  selected: string;
  correctAnswer: string | null;
  correct: boolean;
  reason: string;
}

export interface SubmitQuizResponse {
  score: number;
  correctCount: number;
  total: number;
  results: QuizResult[];
}

// ============================================
// Service Types
// ============================================

export interface WeakTopic {
  topic: string;
  score: number;
  wrongCount: number;
  lastSeenAt: Date;
}

export interface EmbeddingResult {
  id: number;
  vector: number[];
  payload: {
    courseId: string;
    userId: string;
    text: string;
    code: string;
  };
}

export interface SearchResult {
  score: number;
  payload?: {
    text?: string;
    [key: string]: any;
  };
}

// ============================================
// Error Types
// ============================================

export class AIError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AIError.prototype);
  }
}

export class ValidationError extends AIError {
  constructor(message: string) {
    super(400, message);
  }
}

export class NotFoundError extends AIError {
  constructor(message: string) {
    super(404, message);
  }
}

export class ProcessingError extends AIError {
  constructor(message: string) {
    super(500, message);
  }
}