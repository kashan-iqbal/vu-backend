// ============================================
// AI Controller Layer (Refactored & Production-Ready)
// ============================================

import { Request, Response } from "express";
import { qdrant } from "../../config/qrdant";
import {
  NotFoundError,
  ProcessingError,
  UploadHandoutResponse,
  ValidationError,
} from "./ai.types";
import {
  chunkText,
  extractTextFromPdf,
  generateEmbedding,
  isValidText,
} from "./ai.utils";
import {
  analyzeWeakTopics,
  generateQuizWithDocument,
  setExamStage,
  streamChatWithDocument,
  teachWeakTopic,
} from "./ai.service";
import { handleStreamError } from "./error.middleware";
import { SubjectModel } from '../subject/subject.model';
import { AiChatSession } from './ai.model';

// ============================================
// Upload Handout Controller
// ============================================

/**
 * Upload and process PDF to create vector embeddings
 */
export async function uploadHandoutController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { courseId, userId, code } = req.body;
    const file = (req as any).file;

    // Check if model exists (optional - depends on your setup)
    // Uncomment if you're using SubjectModel

    const subject = await SubjectModel.findOne({ subjectCode: code });
    if (subject?.isVectoreExist) {
      res.status(409).json({
        success: false,
        message: "Embeddings already exist for this subject",
      } as UploadHandoutResponse);
      return;
    }


    // Extract text from PDF
    const extractedText = await extractTextFromPdf(file.buffer);

    if (!isValidText(extractedText, 100)) {
      throw new ProcessingError("PDF does not contain sufficient valid text");
    }

    // Chunk the text
    const chunks = await chunkText(extractedText);

    if (chunks.length === 0) {
      throw new ProcessingError("Failed to create text chunks");
    }

    // Create Qdrant collection
    try {
      await qdrant.createCollection(code, {
        vectors: {
          distance: "Cosine",
          size: 1536, // text-embedding-3-small dimension
        },
      });
    } catch (collectionError: any) {
      // Collection might already exist, which is okay
      if (!collectionError.message?.includes("already exists")) {
        throw collectionError;
      }
    }

    // Generate embeddings and prepare points
    const points = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      try {
        const embedding = await generateEmbedding(chunk);

        points.push({
          id: Date.now() + i, // Ensure unique IDs
          vector: embedding,
          payload: {
            courseId,
            userId,
            text: chunk,
            code,
            chunkIndex: i,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (embeddingError) {
        console.error(`Failed to embed chunk ${i}:`, embeddingError);
        // Continue with other chunks
      }
    }

    if (points.length === 0) {
      throw new ProcessingError("Failed to generate any embeddings");
    }

    // Upsert points to Qdrant
    await qdrant.upsert(code, { points });

    // Update subject model (optional)
    // Uncomment if you're using SubjectModel
    /*
    await SubjectModel.updateOne(
      { subjectCode: code },
      { $set: { isVectoreExist: true } }
    );
    */

    res.json({
      success: true,
      message: "PDF processed and embeddings created successfully",
      hasEmbedding: true,
      courseId,
    } as UploadHandoutResponse);
  } catch (error) {
    console.error("Upload error:", error);

    // Clean up collection on failure
    try {
      await qdrant.deleteCollection(req.body.code);
    } catch (cleanupError) {
      console.error("Cleanup error:", cleanupError);
    }

    throw error;
  }
}

// ============================================
// Stream Chat Controller
// ============================================

/**
 * Stream chat responses based on query type
 */
export async function streamChatWithDocController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { userId, courseId, message, queryType, body, code } = req.body;





    // Set streaming headers
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Content-Type-Options", "nosniff");

    // Token writer function
    const writeToken = (token: string) => {
      if (!res.writableEnded) {
        res.write(token);
      }
    };

    // Route to appropriate service based on query type
    switch (queryType) {
      case "GENERAL":
        await streamChatWithDocument({ ...req.body }, writeToken);
        break;

      case "GEN_QUIZ":
        await generateQuizWithDocument({ ...req.body }, writeToken);
        break;

      case "QUIZ_CHECK":
        if (!body || !Array.isArray(body)) {
          writeToken("Invalid quiz data provided.");
        } else {
          await analyzeWeakTopics(code, body, writeToken);
        }
        break;

      case "WEAK_TOPIC_TEACH":
        if (!body || typeof body !== "string") {
          writeToken("Invalid topic provided.");
        } else {
          await teachWeakTopic(code, body, writeToken);
        }
        break;
      case "EXAM_STAGE":
        await setExamStage(userId, message, body, code, writeToken);
        break;

      default:
        writeToken(`Unknown query type: ${queryType}`);
    }

    res.end();
  } catch (error) {
    handleStreamError(res, error);
  }
}

// ============================================
// Generate Quiz Controller (Non-Streaming)
// ============================================

/**
 * Generate quiz (legacy endpoint - kept for compatibility)
 */
export async function generateQuizController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { userId, courseId, code } = req.body;

    if (!code) {
      throw new ValidationError("code is required");
    }

    let quizJson = "";

    // Use streaming service but collect into variable
    await generateQuizWithDocument(code, (token) => {
      quizJson += token;
    });

    // Try to parse the quiz JSON
    try {
      const jsonMatch = quizJson.match(/QUIZ_JSON:\s*(\[.*\])/s);
      if (jsonMatch) {
        const mcqs = JSON.parse(jsonMatch[1]);
        res.json({
          success: true,
          mcqs,
        });
      } else {
        throw new Error("No valid quiz JSON found in response");
      }
    } catch (parseError) {
      console.error("Quiz parse error:", parseError);
      res.json({
        success: false,
        message: "Failed to generate valid quiz",
        rawResponse: quizJson,
      });
    }
  } catch (error) {
    throw error;
  }
}

// ============================================
// Submit Quiz Controller
// ============================================

/**
 * Submit quiz and calculate score
 */
export async function submitQuizController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { quiz, mcqs } = req.body;

    let correctCount = 0;

    const results = quiz.map((answer: any) => {
      const question = mcqs.find((q: any) => q.question === answer.question);

      if (!question) {
        return {
          question: answer.question,
          selected: answer.selected,
          correctAnswer: null,
          correct: false,
          reason: "Question not found in MCQs",
        };
      }

      const correct = question.correctAnswer === answer.selected;
      if (correct) correctCount++;

      return {
        question: question.question,
        selected: answer.selected,
        correctAnswer: question.correctAnswer,
        correct,
        reason: question.reason || "No explanation provided",
      };
    });

    const score = quiz.length > 0 ? (correctCount / quiz.length) * 100 : 0;

    res.json({
      success: true,
      score: Math.round(score * 100) / 100, // Round to 2 decimals
      correctCount,
      total: quiz.length,
      results,
    });
  } catch (error) {
    throw error;
  }
}

// ============================================
// Stream Summary Controller
// ============================================

/**
 * Stream document summary
 */
export async function streamSummaryController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { userId, courseId, code } = req.body as {
      userId: string;
      courseId: string;
      code: string;
    };

    if (!code) {
      throw new ValidationError("code is required");
    }
    // Set streaming headers
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache");

    // Scroll through all documents
    const scrollResult = await qdrant.scroll(code, {
      limit: 1000,
      with_payload: true,
      filter: {
        must: [
          {
            key: "code",
            match: { value: code },
          },
        ],
      },
    });

    const texts = scrollResult.points
      .map((point: any) => point.payload?.text)
      .filter(Boolean);

    if (texts.length === 0) {
      res.write("No documents found to summarize.");
      res.end();
      return;
    }

    const fullText = texts.join("\n\n");

    // Stream summary
    // await streamChatWithDocument(
    //   code,
    //   `Provide a comprehensive summary of this document: ${fullText.substring(0, 1000)}...`,
    //   (token) => {
    //     if (!res.writableEnded) {
    //       res.write(token);
    //     }
    //   }
    // );

    res.end();
  } catch (error) {
    handleStreamError(res, error);
  }
}

// ============================================
// Topic Explanation Controller
// ============================================

/**
 * Explain a specific topic
 */
export async function topicExplanationController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { userId, courseId, topic, code } = req.body;

    if (!code || !topic) {
      throw new ValidationError("code and topic are required");
    }

    let explanation = "";

    await teachWeakTopic(code, topic, (token) => {
      explanation += token;
    });

    res.json({
      success: true,
      explanation,
    });
  } catch (error) {
    throw error;
  }
}