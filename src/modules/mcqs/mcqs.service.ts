import { McqsModel } from "./mcqs.model";
import { Types } from "mongoose";
import { SubjectModel } from "../subject/subject.model";
import { SubscriptionModel } from "../subcription/subscription.model";
import { submitMcqs } from "../result/result.controller";

export async function createMcqsService(data: Array<{
    subjectId: Types.ObjectId | string;
    question: string;
    options: string[];
    correctAnswer: string;
    reasonToCorrect?: string;
    type: string;
}>) {
    // 1) create all mcqs in one go
    const mcqs = await McqsModel.insertMany(
        data.map((d) => ({
            ...d,
            subjectId: new Types.ObjectId(d.subjectId),
        })),
        { ordered: true } // set false if you want it to continue on errors
    );

    // 2) group created mcq ids by subjectId
    const bySubject = new Map<string, Types.ObjectId[]>();

    for (const mcq of mcqs) {
        const sid = mcq.subjectId.toString();
        if (!bySubject.has(sid)) bySubject.set(sid, []);
        bySubject.get(sid)!.push(mcq._id);
    }

    // 3) attach mcqs to subjects (one update per subject)
    await Promise.all(
        Array.from(bySubject.entries()).map(([subjectId, mcqIds]) =>
            SubjectModel.findByIdAndUpdate(subjectId, {
                $addToSet: { mcqsIds: { $each: mcqIds } },
            })
        )
    );

    return mcqs;
}

export async function getMcqsBySubjectService(params: { subjectId: string, type: string }) {
    const subject = await SubjectModel.findOne({ _id: params.subjectId });
    const mcqs = await McqsModel.find({
        _id: { $in: subject?.mcqsIds || [] },
        type: params.type
    })
    return mcqs
}

export async function getMcqsByIdService(id: string) {
    return McqsModel.findById(id);
}

export async function deleteMcqsService(id: string) {
    return McqsModel.findByIdAndDelete(id);
}




export async function getSingleSubjectEligibleMcqs(subjectId: string, userId: Types.ObjectId, type: string) {
    const subject = await SubjectModel.findById(subjectId);
    if (!subject) {
        throw new Error("Subject not found");
    }

    const subscription = await SubscriptionModel.findOne({
        userId,
        subjectId,
        attempts: { $lt: 3 },
        type,
    });


    if (!subscription) {
        throw new Error("Not eligible: subscription missing or attempts exhausted");
    }
    if (subscription.attempts >= 3) {
        return {
            allowed: false,
            reason: "MAX_ATTEMPTS_REACHED",
            message: "Maximum attempts (3) reached",
            remainingAttempts: 0,
        };
    }

    const subjectWithMcqs = await SubjectModel.findById(subjectId).populate({
        path: "mcqsIds",
        match: { type },
        select: "question options type",
    })

    return {
        subject: {
            id: subject._id,
            name: subject.name,
            code: subject.code,
        },
        remainingAttempts: 3 - subscription.attempts,
        subjectWithMcqs,
    };

}
