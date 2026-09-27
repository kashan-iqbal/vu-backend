import { Request, Response } from "express";
import * as QuizService from "./quiz.service";
import { recordTopicStats } from "../readiness/readiness.service";

export async function SubmitQuizResult(req: Request, res: Response) {
    try {
        const data = req.body;
        const userId = req.user?.userId?.toString();

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        if (!Array.isArray(data) || data.length === 0) {
            return res.status(400).json({ message: "No quiz data provided" });
        }

        // Additive: accumulate per-topic attempts/corrects for the readiness
        // engine. Runs for EVERY submission (including perfect scores, which
        // otherwise persist nothing) and is wrapped so it can never affect the
        // existing quiz-submit response. Awaited so the results screen's
        // readiness card reads fresh numbers.
        try {
            const first = data[0];
            if (first?.code && first?.type) {
                await recordTopicStats(userId, String(first.code), String(first.type), data);
            }
        } catch (statErr) {
            console.error("recordTopicStats failed (non-fatal):", statErr);
        }

        const [wrongAnswers, correctAnswers] = QuizService.filterWrongAnswers(data);

        if (wrongAnswers.length === 0) {
            return res.status(200).json({
                message: "Perfect score! No wrong answers.",
                ...QuizService.buildQuizResult(data, wrongAnswers),
            });
        }

        await QuizService.saveWrongAnswers(userId, wrongAnswers, correctAnswers);

        return res.status(200).json({
            message: "Quiz result submitted successfully",
            ...QuizService.buildQuizResult(data, wrongAnswers),
        });

    } catch (error) {
        console.error("SubmitQuizResult error:", error);
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


        const quiz = await QuizService.getSmartQuizService(userId, quizCode);

        if (!quiz || quiz.length === 0) {
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







