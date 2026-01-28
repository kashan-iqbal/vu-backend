import { Request, Response } from "express";
import multer from "multer";
import { chunk, summarizeText } from "./utils";
import { extractTextFromPdf } from "./utils";
import { qdrant } from "../../config/qrdant";
import { openai } from "../../config/openai";
import { success } from "zod";
import { analyzeWeakTopicsService, checkUserQuiz, generateQuizWithDocument, streamChatWithDocument, weakTopicTeachService } from "./ai.service";
import { SubjectModel } from '../subject/subject.model';

export const upload = multer();

export async function uploadHandoutController(req: Request, res: Response) {
  try {
    const { courseId, userId, code } = req.body;
    const file = (req as any).file;


    const subject = await SubjectModel.findOne({ subjectCode: code });

    if (subject?.isVectoreExist) {
      return res.status(409).json({
        message: "Vector already exists for this subject"
      });
    }
    if (!file) {
      return res.status(400).json({ message: "PDF is required" });
    }


    const result = await extractTextFromPdf(file.buffer);

    if (!result) {
      return res.status(400).json({ message: "Empty PDF" });
    }

    await SubjectModel.updateOne(
      { subjectCode: code },
      { $set: { isVectoreExist: true } }
    );
    console.log("Updated subject:", subject);

    const chunks = await chunk(result);

    qdrant.createCollection(code, {
      vectors: {
        distance: "Cosine",
        size: 1536,
      },
    });
    const points = [];

    for (const chunk of chunks) {
      const embeding = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: chunk,
      });

      points.push({
        id: Date.now(),

        vector: embeding.data[0].embedding,
        payload: {
          courseId,
          userId,
          text: chunk,
          code,
        },
      });
    }
    await qdrant.upsert(code, { points });

    res.json({
      message: "PDF parsed successfully",
      success: true,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "PDF parse failed", success: true });
  }
}

export async function streamSummaryController(req: Request, res: Response) {
  try {
    const { userId, courseId, code } = req.query as {
      userId: string;
      courseId: string;
      code: string;
    };

    if (!userId || !courseId) {
      return res
        .status(400)
        .json({ message: "userId and courseId are required" });
    }

    const searchResult = await qdrant.scroll(courseId, {
      limit: 1000, // adjust if needed
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

    const texts = searchResult.points
      .map((point: any) => point.payload?.text)
      .filter(Boolean);

    if (texts.length === 0) {
      return res.status(404).json({ message: "No documents found" });
    }

    const fullText = texts.join("\n\n");

    /* ---------- Setup streaming headers ---------- */
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache");

    /* ---------- Stream summary from OpenAI ---------- */
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      stream: true,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that summarizes study materials clearly and concisely.",
        },
        {
          role: "user",
          content: `Summarize the following course material:\n\n${fullText}`,
        },
      ],
    });

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content;
      if (token) {
        res.write(token);
      }
    }

    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to generate summary" });
  }
}

export async function GenerateQuizController(req: Request, res: Response) {
  try {
    const userId = String(req.body.userId);
    const courseId = String(req.body.courseId);

    if (!userId || !courseId) {
      return res
        .status(400)
        .json({ message: "userId and courseId are required" });
    }

    // 1️⃣ Vector search for relevant chunks
    const queryEmbedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: "Generate MCQs from this course document",
    });

    const searchResult = await qdrant.search(courseId, {
      vector: queryEmbedding.data[0].embedding,
      limit: 20, // adjust based on your document size
      with_payload: true,
      filter: {
        must: [
          {
            key: "courseId",
            match: { value: courseId },
          },
        ],
      },
    });

    const texts = searchResult.map((p: any) => p.payload?.text).filter(Boolean);

    if (texts.length === 0) {
      return res.status(404).json({ message: "No documents found" });
    }

    // 2️⃣ Summarize in batches (token-efficient)
    const batchSize = 5;
    const chunkSummaries: string[] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batchText = texts.slice(i, i + batchSize).join("\n\n");
      const summary = await summarizeText(batchText);
      chunkSummaries.push(summary);
    }

    // 3️⃣ Final summary
    const finalSummary = await summarizeText(chunkSummaries.join("\n\n"));

    // 4️⃣ Generate MCQs from final summary
    const mcqResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You generate MCQs in JSON format. use random topic to generate the MCQs dont use same topic to generate multiple time mcqs generation ok",
        },
        {
          role: "user",
          content: `
Generate 5 MCQs based on the following summary.

Return ONLY JSON array of objects with:
- question
- options (array of 4)
- correctAnswer
- reason

Summary:
${finalSummary}
          `,
        },
      ],
    });

    // const mcqs = JSON.parse(mcqResponse.choices[0].message?.content || "[]");

    return res.json({ mcqResponse });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to generate MCQs" });
  }
}

export async function SubmitQuizController(req: Request, res: Response) {
  try {
    const { quiz, mcqs } = req.body;

    if (!quiz || !mcqs) {
      return res.status(400).json({ message: "quiz and mcqs are required" });
    }

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
        reason: question.reason,
      };
    });

    const score = (correctCount / quiz.length) * 100;

    return res.json({
      score,
      correctCount,
      total: quiz.length,
      results,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to submit quiz" });
  }
}

export async function getRelevantTextFromQdrant(
  userId: string,
  courseId: string,
  question: string,
  code: string,
) {
  const queryEmbedding = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: question,
  });

  const searchResult = await qdrant.search(code, {
    vector: queryEmbedding.data[0].embedding,
    limit: 10,
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

  const texts = searchResult.map((p: any) => p.payload?.text).filter(Boolean);

  return texts.join("\n\n");
}

export async function topicExplainationController(req: Request, res: Response) {
  try {
    const { userId, courseId, topic } = req.body;

    if (!userId || !courseId || !topic) {
      return res
        .status(400)
        .json({ message: "userId, courseId and topic are required" });
    }

    // 1️⃣ Get relevant text from Qdrant
    const contextText = await getRelevantTextFromQdrant(
      userId,
      courseId,
      topic,
    );

    if (!contextText) {
      return res
        .status(404)
        .json({ message: "No relevant content found for this topic" });
    }

    // 2️⃣ Ask AI to explain using the handout context
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a friendly teacher. Explain the topic in a simple way using the given handout context.",
        },
        {
          role: "user",
          content: `
Topic: ${topic}

Handout Context:
${contextText}

Explain this topic in an easy way for students to understand.
Include:
1. Simple explanation
2. 2 examples
3. Key points (bullet list)
4. Short summary

`,
        },
      ],
    });

    const rawText = response.choices[0].message?.content || "";

    return res.json(rawText);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to explain topic" });
  }
}

export async function streamChatWithDocController(req: Request, res: Response) {
  try {
    const { userId, courseId, message, querryType, body, code } = req.body;

    console.log(userId, courseId, message, querryType, body, code)

    // if (!code || !querryType) {
    //   return res.status(400).json({
    //     message: "code and querryType are required",
    //   });
    // }

    // 🔹 Streaming headers
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache");

    switch (querryType) {
      case "GENERAL":
        await streamChatWithDocument(userId, courseId, message, code, (token) =>
          res.write(token),
        );

        res.end();

        break;

      case "GEN_QUIZ":
        await generateQuizWithDocument(userId, courseId, code, (token) =>
          res.write(token),
        );

        res.end();

        break;
      case "QUIZ_CHECK":
        await analyzeWeakTopicsService(userId, courseId, body, (token) =>
          res.write(token),
        );

        res.end();

        break;
      case "WEAK_TOPIC_TEACH":
        await weakTopicTeachService(userId, courseId, body, (token) =>
          res.write(token),
        );

        res.end();

        break;

      default:
        break;
    }
  } catch (err) {
    console.error(err);
    res.status(500).end("Failed to stream response");
  }
}
