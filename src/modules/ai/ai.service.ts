import { openai } from "./../../config/openai";
import { qdrant } from "../../config/qrdant";
import { getRelevantTextFromQdrant } from "./ai.controller";

export async function embedText(text: string): Promise<number[]> {
  if (!text || !text.trim()) {
    throw new Error("embedText: empty text provided");
  }

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  return response.data[0].embedding;
}
export async function searchChunks(
  vector: number[],
  collectionName: string, // courseId for NOW
  filter: any,
  limit = 20,
  minScore = 0.25,
) {
  const res = await qdrant.search(collectionName, {
    vector,
    limit,
    with_payload: true,
    filter: {
      must: [
        {
          key: "courseId",
          match: { value: collectionName },
        },
      ],
    },
  });

  return res.filter((r: any) => r.score >= minScore);
}

export async function streamChatWithDocument(
  userId: string,
  courseId: string,
  question: string,
  code: string,
  onToken: (token: string) => void,
) {
  const context = await getRelevantTextFromQdrant(userId, courseId, question, code);

  console.log(context);

  if (!context.length) {
    onToken("you question is not in the handout.");
    return;
  }

  // 3️⃣ Stream from OpenAI
  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    stream: true,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: `You are an academic AI tutor and exam assistant for university students.

You must STRICTLY use ONLY the provided Document Context.
Do NOT use external knowledge, assumptions, or general information.

Your task is to understand the USER INTENT and respond accordingly:

1. If the user asks a QUESTION (e.g. "what is", "explain", "define"):
   - Answer clearly using the document context only.
   - Include examples ONLY if they exist in the context.

2. If the user asks to GENERATE content (e.g. MCQs, short questions, summaries, notes):
   - Generate the requested content strictly from the document context.
   - Use terminology, definitions, and examples exactly as in the document.

3. If the user input is grammatically weak or informal:
   - Infer the intent carefully.
   - Do NOT reject the request if the topic exists in the context.

4. If the topic is PARTIALLY covered in the document:
   - Answer using only the available information.
   - Do NOT add missing details.

5. If the topic is COMPLETELY absent from the document:
   - Respond exactly with:
     "you question is not in the handout."

IMPORTANT RULES:
- Never answer outside the document context.
- Never say "irrelevant question" if the topic exists.
- Never invent facts or examples.
- Be student-friendly and concise.
- Format answers cleanly (paragraphs, bullet points, or numbered lists when appropriate).
`,
      },
      {
        role: "user",
        content: `
Question:
${question}

Document Context:
${context}
`,
      },
    ],
  });

  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content;
    if (token) {
      onToken(token);
    }
  }
}

export async function generateQuizWithDocument(
  userId: string,
  courseId: string,
  code: string,
  onToken: (token: string) => void,
) {
  const question =
    "Important concepts and definitions discussed in this document";

  const finalSummary = await getRelevantTextFromQdrant(
    userId,
    courseId,
    question,
    code
  );

  console.log(finalSummary)
  if (!finalSummary.length) {
    onToken("you question is not in the handout.");
    return;
  }

  // 3️⃣ Stream from OpenAI
  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    stream: true,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: `You are an academic exam question generator.

STRICT RULES (DO NOT VIOLATE):
- Generate MCQs ONLY from the provided summary.
- Do NOT use any external knowledge.
- Do NOT repeat the same topic if multiple topics are present.
- Randomly select ONE topic from the summary for this quiz generation.
- Generate questions ONLY from that selected topic.
- Each question MUST be clearly answerable from the summary.
- Do NOT invent facts, numbers, or terminology.
- Do NOT include explanations not supported by the summary.
- Do NOT add extra text outside the JSON format.
- If the summary does not contain enough information for MCQs, return an EMPTY JSON array [].

OUTPUT FORMAT RULES:
- Output MUST be a valid JSON array.
- start with prefix QUIZ_JSON:
- Each object MUST contain exactly:
  - "question"
  - "options" (array of exactly 4 strings)
  - "correctAnswer" (must match one option exactly)
  - "reason" (must be directly supported by the summary)
`,
      },
      {
        role: "user",
        content: `Task:
Generate exactly 2 multiple-choice questions (MCQs).

Instructions:
- First, identify distinct topics in the summary.
- Randomly choose ONE topic.
- Generate all 5 MCQs from that single chosen topic.
- Do NOT mention the topic name explicitly in the questions.
- Keep difficulty at undergraduate exam level.

Summary:
${finalSummary}
`,
      },
    ],
  });

  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content;
    if (token) {
      onToken(token);
    }
  }
}


export async function analyzeWeakTopicsService(
  userId: string,
  courseId: string,
  wrongAnswers: any[],
  onToken: (token: string) => void,
) {
  if (!wrongAnswers || !wrongAnswers.length) {
    onToken("No incorrect answers provided.");
    return;
  }

  // 🔹 Step 1: Build a semantic query from wrong answers
  const analysisQuery = `
Analyze the following incorrect answers and identify the related concepts:
${wrongAnswers
      .map(
        (w) =>
          `Question: ${w.question}
Selected Answer: ${w.selected}
Correct Answer: ${w.correct}`
      )
      .join("\n\n")}
`;

  // 🔹 Step 2: Retrieve supporting document context
  const context = await getRelevantTextFromQdrant(
    userId,
    courseId,
    analysisQuery
  );

  if (!context || context.length < 100) {
    onToken("Relevant content not found in the document.");
    return;
  }

  // 🔹 Step 3: Ask LLM to analyze weakness (NOT generate MCQs)
  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    stream: true,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: `
You are an academic tutor analyzing student mistakes.

RULES:
- Use ONLY the provided document context.
- Identify weak topics based on incorrect answers.
- Explain why the student is weak in those topics.
- Suggest what to study next from the document.
- Do NOT generate quiz questions.
- Do NOT use external knowledge.
- Be clear and student-friendly.
`
      },
      {
        role: "user",
        content: `
Incorrect Answers:
${analysisQuery}

Document Context:
${context}

Task:
1. Identify weak topic(s)
2. Explain the misunderstanding
3. Suggest what the student should revise
`
      }
    ],
  });

  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content;
    if (token) onToken(token);
  }
}




export async function weakTopicTeachService(userId: string,
  courseId: string,
  wrongAnswers: any[],
  onToken: (token: string) => void,) {



}