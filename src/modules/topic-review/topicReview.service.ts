import { WrongAnswerModel } from "../ai-quiz/wrongAnswer.model";
import { QuizModel, Iquiz } from "../ai-quiz/quiz.model";
import { deepseek } from "../../config/deepseek";
import { env } from "../../config/env";

export interface TopicReviewItem {
    topic: string;
    explanation: string;
    missedCount: number;
}

export interface TopicReviewResult {
    code: string;
    type: string;
    topics: TopicReviewItem[];
}

// Read the user's wrong answers for this course+type, then look up the ACTUAL
// missed questions in the quiz collection (by the stored numeric quizId, which
// maps to QuizModel.id — not _id, and we query explicitly rather than populate
// because the schema ref name doesn't match the registered model name).
async function getMissedQuestionsByTopic(
    userId: string,
    code: string,
    type: string,
): Promise<Map<string, Iquiz[]>> {
    const byTopic = new Map<string, Iquiz[]>();

    const wrongs = await WrongAnswerModel.find({ userId, code, type }).lean();
    if (wrongs.length === 0) return byTopic;

    const quizIds = wrongs.map((w) => w.quizId);
    const questions = await QuizModel.find({ id: { $in: quizIds } }).lean<Iquiz[]>();

    for (const q of questions) {
        const list = byTopic.get(q.topic_name) ?? [];
        list.push(q);
        byTopic.set(q.topic_name, list);
    }

    // Cover any wrong topic whose question is no longer in the quiz collection
    // (name-only entry) so it still gets an explanation.
    for (const w of wrongs) {
        if (!byTopic.has(w.topic_name)) byTopic.set(w.topic_name, []);
    }

    return byTopic;
}

function buildPrompt(code: string, topic: string, questions: Iquiz[]) {
    const system = `You are a concise university exam tutor for the course "${code}". Explain concepts clearly in 3 to 4 short lines suitable for quick exam revision. Do not use headings, lists, or any preamble — return only the explanation.`;

    if (questions.length === 0) {
        return {
            system,
            user: `Explain the core concept of the topic "${topic}" (course ${code}) in 3-4 lines for exam revision.`,
        };
    }

    const context = questions
        .map((q, i) => {
            const options = q.options
                .map((opt, idx) => `${String.fromCharCode(65 + idx)}) ${opt}`)
                .join("\n");
            const correct = `${String.fromCharCode(65 + q.correctAnswer)}) ${q.options[q.correctAnswer]}`;
            return [
                `Question ${i + 1}: ${q.question}`,
                options,
                `Correct answer: ${correct}`,
                q.explanation ? `Note: ${q.explanation}` : "",
            ]
                .filter(Boolean)
                .join("\n");
        })
        .join("\n\n");

    return {
        system,
        user: `The student answered the following question(s) on the topic "${topic}" incorrectly:\n\n${context}\n\nExplain the core concept of "${topic}" in 3-4 lines so the student understands what they missed.`,
    };
}

async function explainTopic(
    code: string,
    topic: string,
    questions: Iquiz[],
): Promise<string> {
    if (!env.DEEPSEEK_API_KEY) {
        return "AI explanation is unavailable right now (DEEPSEEK_API_KEY is not configured).";
    }

    try {
        const { system, user } = buildPrompt(code, topic, questions);
        const completion = await deepseek.chat.completions.create({
            model: "deepseek-chat",
            messages: [
                { role: "system", content: system },
                { role: "user", content: user },
            ],
            temperature: 0.5,
            max_tokens: 220,
        });

        return (
            completion.choices[0]?.message?.content?.trim() ||
            "No explanation was generated for this topic."
        );
    } catch (error) {
        console.error(`explainTopic failed for "${topic}":`, error);
        return "We couldn't generate an explanation for this topic right now. Please try again later.";
    }
}

export async function buildTopicReview(
    userId: string,
    quizCode: string,
): Promise<TopicReviewResult> {
    const [type, rawCode] = quizCode.split("-");
    const code = (rawCode ?? "").toUpperCase(); // stored uppercase in both collections

    const byTopic = await getMissedQuestionsByTopic(userId, code, type);

    const topics = await Promise.all(
        [...byTopic.entries()].map(async ([topic, questions]) => ({
            topic,
            explanation: await explainTopic(code, topic, questions),
            missedCount: questions.length,
        })),
    );

    return { code, type, topics };
}
