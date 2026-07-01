import { Request, Response } from "express";
import { buildTopicReview } from "./topicReview.service";

export async function getTopicReview(req: Request, res: Response) {
    try {
        const userId = req.user?.userId?.toString();
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { quizCode } = req.params;
        if (!quizCode || !quizCode.includes("-")) {
            return res.status(400).json({ message: "Invalid quiz code" });
        }

        const result = await buildTopicReview(userId, quizCode);
        return res.status(200).json(result);
    } catch (error) {
        console.error("getTopicReview error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}
