import { Request, Response } from "express";
import * as QuizService from "./quiz.service";
import { recordTopicStats } from "../readiness/readiness.service";
import { submitAttemptSchema } from "./quiz.schema";

// Shared tail of both submit paths: persist the server's own verdicts, then build
// the response. Takes graded rows only — nothing here reads the request body.
async function finishSubmission(
    userId: string,
    code: string,
    type: string,
    graded: {
        rows: QuizService.GradedRow[];
        wrong: Array<{ id: number; code: string; type: string; topic_name: string }>;
        correct: Array<{ id: number }>;
    },
) {
    // Additive: accumulate per-topic attempts/corrects for the readiness engine.
    // Runs for EVERY submission (including perfect scores, which otherwise persist
    // nothing) and is wrapped so it can never affect the submit response. Awaited
    // so the results screen's readiness card reads fresh numbers.
    try {
        if (code && type) {
            await recordTopicStats(userId, code, type, graded.rows);
        }
    } catch (statErr) {
        console.error("recordTopicStats failed (non-fatal):", statErr);
    }

    await QuizService.saveWrongAnswers(userId, graded.wrong, graded.correct);

    const answeredRows = graded.rows.filter((r) => r.answered);
    const result = {
        totalQuestions: graded.rows.length,
        correct: answeredRows.filter((r) => r.correct).length,
        wrong: graded.rows.length - answeredRows.filter((r) => r.correct).length,
        wrongTopics: [...new Set(graded.wrong.map((w) => w.topic_name))],
    };

    return {
        message:
            graded.wrong.length === 0
                ? "Perfect score! No wrong answers."
                : "Quiz result submitted successfully",
        ...result,
    };
}

export async function SubmitQuizResult(req: Request, res: Response) {
    try {
        const userId = req.user?.userId?.toString();

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        // Preferred path: the body names a server-side attempt and carries no
        // answers at all, so the score is unforgeable.
        const asAttempt = submitAttemptSchema.safeParse(req.body);
        if (asAttempt.success) {
            const graded = await QuizService.submitAttempt(
                userId,
                asAttempt.data.attemptId,
            );
            if (!graded) {
                return res.status(404).json({ message: "Quiz attempt not found" });
            }

            const payload = await finishSubmission(
                userId,
                graded.code,
                graded.type,
                graded,
            );
            return res.status(200).json(payload);
        }

        // Legacy path: a client that loaded its quiz before this deploy. Re-grade
        // every item against the database and discard whatever it claimed.
        const data = req.body;
        if (!Array.isArray(data) || data.length === 0) {
            return res.status(400).json({ message: "No quiz data provided" });
        }

        const graded = await QuizService.gradeLegacySubmission(data);
        if (graded.rows.length === 0) {
            return res.status(400).json({ message: "No recognised questions in submission" });
        }

        const first = data[0];
        const payload = await finishSubmission(
            userId,
            String(first?.code ?? ""),
            String(first?.type ?? ""),
            graded,
        );
        return res.status(200).json(payload);
    } catch (error) {
        console.error("SubmitQuizResult error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

// Grade a single answer the moment the student commits to it. This is what keeps
// the instant correct/wrong reveal working now that the answer key never ships to
// the browser: the explanation and the right option arrive only after the choice
// is locked in server-side.
export async function GradeQuizAnswer(req: Request, res: Response) {
    try {
        const userId = req.user?.userId?.toString();

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { attemptId, id, selectedOption } = req.body;

        const graded = await QuizService.gradeAnswer(
            userId,
            String(attemptId),
            Number(id),
            Number(selectedOption),
        );

        if (!graded) {
            return res
                .status(404)
                .json({ message: "Quiz attempt or question not found" });
        }

        return res.status(200).json(graded);
    } catch (error) {
        console.error("GradeQuizAnswer error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export async function getSmartQuiz(req: Request, res: Response) {
    try {
        const userId = req.user?.userId?.toString();

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { quizCode } = req.params;

        const quiz = await QuizService.createAttempt(userId, quizCode);

        if (!quiz || quiz.questions.length === 0) {
            // 404 tells the frontend to offer the "contribute this course's PDF"
            // redirect (tracked upload flow), rather than a quiz.
            return res.status(404).json({ message: "No questions found for this course" });
        }

        return res.status(200).json(quiz);
    } catch (error) {
        console.error("getSmartQuiz error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}
