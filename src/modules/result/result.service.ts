import { SubmitResultModel } from "./submitResult.model";
import { ResultModel } from "./result.model";
import { McqsModel } from "../mcqs/mcqs.model";
import { Types } from "mongoose";

export async function submitResultService(
    userId: Types.ObjectId,
    mcqs: { mcqsId: Types.ObjectId; selectedOption: string }[]
) {
    return SubmitResultModel.create({
        userId,
        mcqs,
    });
}

export async function calculateResultService(
    submitResultId: Types.ObjectId
) {
    const submission = await SubmitResultModel.findById(submitResultId);
    if (!submission) throw new Error("Submission not found");

    let correct = 0;

    for (const item of submission.mcqs) {
        const mcq = await McqsModel.findById(item.mcqsId);
        if (mcq && mcq.correctAnswer === item.selectedOption) {
            correct++;
        }
    }

    const total = submission.mcqs.length;
    const score = Math.round((correct / total) * 100);

    return ResultModel.create({
        userId: submission.userId,
        submitResultId,
        totalMcqs: total,
        correctMcqs: correct,
        score,
    });
}

export async function getUserResultsService(userId: string) {
    return ResultModel.find({ userId })
        .populate("submitResultId")
        .sort({ createdAt: -1 });
}
