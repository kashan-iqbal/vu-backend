import { Request, Response } from "express";
import * as QuizService from "./quiz.service";
import { UserModel } from "../user/user.model";
import { sendEmail } from "../../common/utils/sendEmail";

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

        const wrongAnswers = QuizService.filterWrongAnswers(data);

        if (wrongAnswers.length === 0) {
            return res.status(200).json({
                message: "Perfect score! No wrong answers.",
                ...QuizService.buildQuizResult(data, wrongAnswers),
            });
        }

        await QuizService.saveWrongAnswers(userId, wrongAnswers);

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
            return res.status(404).json({ uploadPdf: true, message: "No questions found for this course" });
        }

        return res.status(200).json(quiz);

    } catch (error) {
        console.error("getSmartQuiz error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}


// POST /quiz/upload-pdf — a student contributes the course material as a PDF.
// The file is streamed straight into an email attachment (to the SMTP account)
// with the course + student details; nothing is persisted.
export async function uploadCoursePdf(req: Request, res: Response) {
    try {
        const userId = req.user?.userId?.toString();
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        if (!req.file) {
            return res.status(400).json({ message: "A PDF file is required" });
        }

        const { code, courseTitle, note } = req.body as {
            code: string;
            courseTitle: string;
            note?: string;
        };

        const recipient = process.env.SMTP_USER;
        if (!recipient) {
            return res.status(500).json({ message: "Email is not configured" });
        }

        const user = await UserModel.findById(userId).select("name email");

        const subject = `Course PDF: ${code}`;
        const lines = [
            "A student uploaded a course PDF.",
            "",
            `Course: ${courseTitle} (${code})`,
            `Student: ${user?.name ?? "Unknown"} <${user?.email ?? "unknown"}>`,
            `Student ID: ${userId}`,
            note ? `Note: ${note}` : "",
        ].filter(Boolean);

        await sendEmail(recipient, subject, lines.join("\n"), `<p>${lines.join("<br/>")}</p>`, [
            {
                filename: req.file.originalname || `${code}.pdf`,
                content: req.file.buffer,
                contentType: "application/pdf",
            },
        ]);

        return res.status(200).json({
            success: true,
            message: "PDF uploaded successfully. Thank you for contributing!",
        });
    } catch (error) {
        console.error("uploadCoursePdf error:", error);
        return res.status(500).json({ message: "Failed to upload PDF. Please try again." });
    }
}









