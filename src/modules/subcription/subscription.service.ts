import { SubscriptionModel } from "./subscription.model";
import { Types } from "mongoose";

export async function createSubscriptionService(
    userId: Types.ObjectId,
    subjectId: Types.ObjectId,
    type: string
) {
    return SubscriptionModel.create({
        userId,
        subjectId,
        type
    });
}

export async function getUserSubscriptionsService(userId: string) {
    return SubscriptionModel.find({ userId })
        .sort({ createdAt: -1 });
}

export async function incrementAttemptService(
    userId: Types.ObjectId,
    subjectId: Types.ObjectId
) {
    const result = await SubscriptionModel.findOneAndUpdate(
        { userId, subjectId, attempts: { $lt: 3 } },
        { $inc: { attempts: 1 } },
        { new: true }
    );

    if (!result) {
        throw new Error("Maximum attempts reached or no subscription found");
    }

    return result;
}

export async function checkSubscriptionService(
    userId: Types.ObjectId,
    subjectId: Types.ObjectId
) {
    return SubscriptionModel.findOne({ userId, subjectId });
}
