import mongoose from "mongoose";
import { QuizModel, Iquiz } from "./quiz.model";
import { WrongAnswerModel } from "./wrongAnswer.model";
import { QuizAttemptModel, type IAttemptQuestion } from "./quizAttempt.model";
import {
    shuffleQuestionOptions,
    toOriginalIndex,
    toDisplayIndex,
} from "./quiz.shuffle";

// How many MCQs one sitting serves. Was 15 in the weak-topic branch but 5 in the
// "nothing wrong yet" branch, so a student with a clean record silently got a
// third of a quiz. One constant now drives both, and the frontend reads the
// delivered length rather than hardcoding a number.
export const QUIZ_LENGTH = 15;
const WEAK_TOPIC_SHARE = 10; // of QUIZ_LENGTH, drawn from topics the user got wrong

/** One question as the browser is allowed to see it: no answer, no explanation. */
export interface DeliveredQuestion {
    id: number;
    question: string;
    options: string[];
    topic_name: string;
    code: string;
    type: string;
}

export interface DeliveredQuiz {
    attemptId: string;
    code: string;
    type: string;
    questions: DeliveredQuestion[];
}

/** What the per-answer grade endpoint hands back, once the answer is locked in. */
export interface GradedAnswer {
    correct: boolean;
    /** Where the right option sits in the shuffled list this student was served. */
    correctOption: number;
    explanation: string;
}

/** A server-graded verdict per question, as recordTopicStats consumes it. */
export interface GradedRow {
    topic_name: string;
    answered: boolean;
    correct: boolean;
}

export async function saveWrongAnswers(
    userId: string,
    wrongAnswers: Array<{ id: number; code: string; type: string; topic_name: string }>,
    correctAnswers: Array<{ id: number }>,
): Promise<void> {
    // Clear ONLY the questions this student just got right. The previous version
    // ran deleteMany on every topic touched by the quiz, so getting one question
    // right wiped the record of everything else missed in that topic — wrong-answer
    // history was destroyed on each submit instead of accumulating. Per-question
    // removal keeps "still wrong" accurate without nuking the topic.
    const correctIds = correctAnswers.map((quiz) => quiz.id);
    if (correctIds.length > 0) {
        await WrongAnswerModel.deleteMany({ userId, quizId: { $in: correctIds } });
    }

    if (wrongAnswers.length === 0) return;

    const bulkOps = wrongAnswers.map((quiz) => ({
        updateOne: {
            filter: { userId, quizId: quiz.id },
            update: {
                $set: {
                    userId,
                    quizId: quiz.id,
                    code: quiz.code,
                    type: quiz.type,
                    topic_name: quiz.topic_name,
                },
            },
            upsert: true,
        },
    }));

    await WrongAnswerModel.bulkWrite(bulkOps);
}

export function buildQuizResult(
    data: Array<{ topic_name: string }>,
    wrongAnswers: Array<{ topic_name: string }>,
) {
    return {
        totalQuestions: data.length,
        correct: data.length - wrongAnswers.length,
        wrong: wrongAnswers.length,
        wrongTopics: [...new Set(wrongAnswers.map((q) => q.topic_name))],
    };
}


export async function getSmartQuizService(userId: string, quizCode: string) {
    const [type, code] = quizCode.split("-");


    // Step 1: Get wrong topic_names for this user + course
    const wrongAnswers = await WrongAnswerModel.find(
        { userId, code, type },
        { topic_name: 1, _id: 0 }
    ).lean();

    const wrongTopics = [...new Set(wrongAnswers.map((w) => w.topic_name))];


    // Step 2: No wrong answers → send a full random quiz (not a short one)
    if (wrongTopics.length === 0) {
        return QuizModel.aggregate([
            { $match: { type, code } },
            { $sample: { size: QUIZ_LENGTH } }
        ]);
    }

    // Step 3: weak-topic questions + the rest random from other topics
    const [wrongTopicQuestions, randomQuestions] = await Promise.all([
        QuizModel.aggregate([
            { $match: { type, code, topic_name: { $in: wrongTopics } } },
            { $sample: { size: WEAK_TOPIC_SHARE } },
        ]),

        QuizModel.aggregate([
            { $match: { type, code, topic_name: { $nin: wrongTopics } } },
            { $sample: { size: QUIZ_LENGTH - WEAK_TOPIC_SHARE } },
        ]),
    ]);

    // Step 4: If wrong topics don't have enough questions fill remaining from random
    const combined = [...wrongTopicQuestions, ...randomQuestions];

    if (combined.length < QUIZ_LENGTH) {
        const existingIds = combined.map((q) => q._id);
        const filler = await QuizModel.aggregate([
            { $match: { type, code, _id: { $nin: existingIds } } },
            { $sample: { size: QUIZ_LENGTH - combined.length } },
        ]);
        combined.push(...filler);
    }

    // Step 5: Shuffle final array so wrong topics aren't always first
    return combined.sort(() => Math.random() - 0.5);
}

/**
 * Draw a quiz, shuffle each question's options, persist the attempt, and return
 * only what the browser may see. `correctAnswer` and `explanation` are stripped —
 * they are served one question at a time by gradeAnswer() once the student has
 * committed to a choice, which is what keeps instant feedback working without
 * handing the answer key to the client.
 */
export async function createAttempt(
    userId: string,
    quizCode: string,
): Promise<DeliveredQuiz | null> {
    const drawn = (await getSmartQuizService(userId, quizCode)) as Iquiz[];
    if (!drawn || drawn.length === 0) return null;

    const [type, code] = quizCode.split("-");

    const attemptQuestions: IAttemptQuestion[] = [];
    const delivered: DeliveredQuestion[] = [];

    for (const q of drawn) {
        const { options, order } = shuffleQuestionOptions(q.options);

        attemptQuestions.push({
            quizId: q.id,
            topic_name: q.topic_name,
            order,
            selected: null,
            correct: null,
            answeredAt: null,
        });

        delivered.push({
            id: q.id,
            question: q.question,
            options,
            topic_name: q.topic_name,
            code: q.code,
            type: q.type,
        });
    }

    const attempt = await QuizAttemptModel.create({
        userId,
        code: code?.toUpperCase(),
        type,
        questions: attemptQuestions,
        status: "active",
        startedAt: new Date(),
    });

    return {
        attemptId: String(attempt._id),
        code: code?.toUpperCase(),
        type,
        questions: delivered,
    };
}

/**
 * Grade one answer against the database. The client sends the DISPLAY index it
 * rendered; the stored shuffle order maps it back to the real option index. The
 * first answer for a question wins — re-answering cannot change a locked grade,
 * which matches the UI (options disable once tapped) and stops a student probing
 * for the right option.
 */
export async function gradeAnswer(
    userId: string,
    attemptId: string,
    quizId: number,
    displayIndex: number,
): Promise<GradedAnswer | null> {
    if (!mongoose.isValidObjectId(attemptId)) return null;

    const attempt = await QuizAttemptModel.findOne({
        _id: attemptId,
        userId,
        status: "active",
    });
    if (!attempt) return null;

    const entry = attempt.questions.find((q: IAttemptQuestion) => q.quizId === quizId);
    if (!entry) return null;

    const question = await QuizModel.findOne(
        { id: quizId },
        { correctAnswer: 1, explanation: 1, _id: 0 },
    ).lean<Pick<Iquiz, "correctAnswer" | "explanation">>();
    if (!question) return null;

    const correctOption = toDisplayIndex(entry.order, question.correctAnswer);

    // Already answered → replay the stored grade, don't re-record it.
    if (entry.selected !== null) {
        return {
            correct: entry.correct === true,
            correctOption,
            explanation: question.explanation ?? "",
        };
    }

    const originalIndex = toOriginalIndex(entry.order, displayIndex);
    const correct = originalIndex !== null && originalIndex === question.correctAnswer;

    entry.selected = originalIndex;
    entry.correct = correct;
    entry.answeredAt = new Date();
    await attempt.save();

    return {
        correct,
        correctOption,
        explanation: question.explanation ?? "",
    };
}

/**
 * Close an attempt and score it from what the server recorded. Nothing the client
 * sends influences the score — it only names the attempt. Returns the graded rows
 * so the caller can feed topicstats and the wrong-answer set with server truth.
 */
export async function submitAttempt(
    userId: string,
    attemptId: string,
): Promise<{
    rows: GradedRow[];
    wrong: Array<{ id: number; code: string; type: string; topic_name: string }>;
    correct: Array<{ id: number }>;
    code: string;
    type: string;
} | null> {
    if (!mongoose.isValidObjectId(attemptId)) return null;

    const attempt = await QuizAttemptModel.findOne({ _id: attemptId, userId });
    if (!attempt) return null;

    if (attempt.status === "active") {
        attempt.status = "submitted";
        attempt.submittedAt = new Date();
        await attempt.save();
    }

    const rows: GradedRow[] = [];
    const wrong: Array<{ id: number; code: string; type: string; topic_name: string }> = [];
    const correct: Array<{ id: number }> = [];

    for (const q of attempt.questions as IAttemptQuestion[]) {
        rows.push({
            topic_name: q.topic_name,
            answered: q.selected !== null,
            correct: q.correct === true,
        });

        if (q.selected === null) continue;
        if (q.correct === true) {
            correct.push({ id: q.quizId });
        } else {
            wrong.push({
                id: q.quizId,
                code: attempt.code,
                type: attempt.type,
                topic_name: q.topic_name,
            });
        }
    }

    return { rows, wrong, correct, code: attempt.code, type: attempt.type };
}

/**
 * Legacy submit path: the client posts the questions it was served. Kept so a quiz
 * opened before this deploy can still be submitted, but it no longer trusts the
 * body — `correctAnswer` is re-read from the database by `id` and anything the
 * client claimed is discarded. Unknown ids are dropped rather than counted.
 */
export async function gradeLegacySubmission(
    items: Array<{ id: number; selectedOption: number; code: string; type: string }>,
): Promise<{
    rows: GradedRow[];
    wrong: Array<{ id: number; code: string; type: string; topic_name: string }>;
    correct: Array<{ id: number }>;
}> {
    const ids = items.map((i) => i.id);
    const questions = await QuizModel.find(
        { id: { $in: ids } },
        { id: 1, correctAnswer: 1, topic_name: 1, code: 1, type: 1, _id: 0 },
    ).lean<Array<Pick<Iquiz, "id" | "correctAnswer" | "topic_name" | "code" | "type">>>();

    const byId = new Map(questions.map((q) => [q.id, q]));

    const rows: GradedRow[] = [];
    const wrong: Array<{ id: number; code: string; type: string; topic_name: string }> = [];
    const correct: Array<{ id: number }> = [];

    for (const item of items) {
        const q = byId.get(item.id);
        if (!q) continue; // unknown id — never score something we can't verify

        const answered = Number.isInteger(item.selectedOption) && item.selectedOption >= 0;
        const isCorrect = answered && item.selectedOption === q.correctAnswer;

        rows.push({
            topic_name: q.topic_name,
            answered,
            correct: isCorrect,
        });

        if (!answered) continue;
        if (isCorrect) {
            correct.push({ id: q.id });
        } else {
            wrong.push({
                id: q.id,
                code: q.code,
                type: q.type,
                topic_name: q.topic_name,
            });
        }
    }

    return { rows, wrong, correct };
}
