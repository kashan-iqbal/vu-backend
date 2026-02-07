// ============================================
// AI Service Layer (Refactored & Production-Ready)
// ============================================

import { openai } from "../../config/openai";
import { qdrant } from "../../config/qrdant";
import { AiChatSession } from './ai.model';
import {
  NotFoundError,
  ProcessingError,
  SearchResult,
  ValidationError,
} from "./ai.types";
import { generateEmbedding, streamOpenAIResponse } from "./ai.utils";
import { generalChatPrompt, mcqsChatPrompt, setExamTypePrompt, teachWeakTopicPrompt } from './prompt.templates';

// ============================================
// Qdrant Operations
// ============================================

/**
 * Search for similar chunks in Qdrant
 */
// export async function searchChunks(
//   vector: number[],
//   collectionName: string,
//   limit = 10,
//   minScore = 0.25
// ): Promise<SearchResult[]> {
//   try {
//     const results = await qdrant.search(collectionName, {
//       vector,
//       limit,
//       with_payload: true,
//       filter: {
//         must: [
//           {
//             key: "code",
//             match: { value: collectionName },
//           },
//         ],
//       },
//     });

//     return results.filter((r: any) => r.score >= minScore);
//   } catch (error: any) {
//     throw new ProcessingError(`Failed to search chunks: ${error.message}`);
//   }
// }

/**
 * Get relevant text from Qdrant based on query
 */
export async function getRelevantContext(
  code: string,
  question: string,
  limit = 10
): Promise<string> {
  try {
    const queryEmbedding = await generateEmbedding(question);

    const searchResults = await qdrant.search(code, {
      vector: queryEmbedding,
      limit,
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

    const texts = searchResults
      .map((result: any) => result.payload?.text)
      .filter(Boolean);

    if (texts.length === 0) {
      return "";
    }

    return texts.join("\n\n");
  } catch (error: any) {
    throw new ProcessingError(`Failed to get relevant context: ${error.message}`);
  }
}

// ============================================
// Chat Streaming Service
// ============================================

/**
 * Stream chat response with document context
 */
export async function streamChatWithDocument(
  { ...rest },
  onToken: (token: string) => void
): Promise<void> {
  try {

    const { message, code } = rest
    let question = message

    // Get relevant context from Qdrant
    const context = await getRelevantContext(code, question);

    if (!context || context.length < 50) {
      onToken("I couldn't find relevant information in the document to answer your question.");
      return;
    }

    const messages = generalChatPrompt(question, context)

    await streamOpenAIResponse(messages, onToken);
  } catch (error: any) {
    throw new ProcessingError(`Failed to stream chat: ${error.message}`);
  }
}

// ============================================
// Quiz Generation Service
// ============================================

/**
 * Generate quiz based on document content
 */
export async function generateQuizWithDocument(
  { ...rest },
  onToken: (token: string) => void
): Promise<void> {
  try {
    const { code } = rest
    const question = "Important concepts and definitions discussed in this document";

    const context = await getRelevantContext(code, question, 15);

    if (!context || context.length < 100) {
      onToken("Not enough content in the document to generate a quiz.");
      return;
    }


    const message = mcqsChatPrompt(context);
    await streamOpenAIResponse(message, onToken);
  } catch (error: any) {
    throw new ProcessingError(`Failed to generate quiz: ${error.message}`);
  }
}

// ============================================
// Weak Topics Analysis Service
// ============================================

/**
 * Analyze weak topics based on wrong answers
 */
export async function analyzeWeakTopics(
  code: string,
  wrongAnswers: any[],
  onToken: (token: string) => void
): Promise<void> {
  try {
    if (!wrongAnswers || wrongAnswers.length === 0) {
      onToken("No incorrect answers provided for analysis.");
      return;
    }

    // Build analysis query
    const analysisQuery = `
Analyze these incorrect answers and identify related concepts:
${wrongAnswers
        .map(
          (w, idx) =>
            `${idx + 1}. Question: ${w.question}
   Your Answer: ${w.selected || w.correctAnswer}
   Correct Answer: ${w.correct || w.correctAnswer}`
        )
        .join("\n\n")}
`;

    const context = await getRelevantContext(code, analysisQuery, 15);

    if (!context || context.length < 100) {
      onToken("I couldn't find relevant content in the document for analysis.");
      return;
    }

    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      stream: true,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `You are an academic tutor analyzing student mistakes.

RULES:
- Use ONLY the provided document context
- Identify weak topics based on incorrect answers
- Explain why the student is weak in those topics
- Suggest what to study next from the document
- Do NOT generate quiz questions
- Be clear and student-friendly

FORMAT:
1. **Weak Topics Identified:**
   - Topic 1
   - Topic 2

2. **Why You're Weak:**
   - Explanation

3. **What to Study:**
   - Specific sections/concepts from the document
`,
        },
        {
          role: "user",
          content: `Incorrect Answers:
${analysisQuery}

Document Context:
${context}

Please analyze my weak areas and suggest what to study.`,
        },
      ],
    });

    let hasContent = false;

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content;
      if (token) {
        hasContent = true;
        onToken(token);
      }
    }

    if (!hasContent) {
      onToken("Failed to analyze weak topics. Please try again.");
    }
  } catch (error: any) {
    throw new ProcessingError(`Failed to analyze weak topics: ${error.message}`);
  }
}

// ============================================
// Weak Topic Teaching Service (Future Implementation)
// ============================================

/**
 * Teach weak topics in detail
 */
export async function teachWeakTopic(
  code: string,
  topic: string,
  onToken: (token: string) => void
): Promise<void> {
  try {
    const context = await getRelevantContext(code, topic, 10);

    if (!context || context.length < 100) {
      onToken("I couldn't find information about this topic in the document.");
      return;
    }


    const message = teachWeakTopicPrompt(topic, context);
    await streamOpenAIResponse(message, onToken);
  }
  catch (error: any) {
    throw new ProcessingError(`Failed to teach weak topic: ${error.message}`);
  }
}

// ============================================
// Set Exam Stage Service
// ============================================

/**
 * Set exam stage and extract topics
 */
export async function setExamStage(userId: string,
  message: any, body: any, code: string,
  onToken: (token: string) => void) {
  try {

    const existingSession = await AiChatSession.findOne({
      userId, code,
    })

    if (!existingSession) {
      await new AiChatSession({
        userId,
        examType: body,
        code
      }).save()

    }


    const question = `
Extract all lecture, lesson, or topic titles with their serial numbers.

Rules:
- Prefer "Table of Contents" if present.
- If no Table of Contents exists, extract headings such as
  Lesson, Lecture, Unit, or main topic titles in order.
- Preserve original numbering if available.
`

    const context = await getRelevantContext(code, question, 15);



    if (!context || context.length < 100) {
      onToken("Not enough content in the document to generate a quiz.");
      return;
    }


    const message = setExamTypePrompt(body, context);

    await streamOpenAIResponse(message, onToken);

  } catch (error: any) {

    throw new ProcessingError(`Failed to process setExamType: ${error.message}`);
  }
}