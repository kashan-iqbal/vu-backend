import { Request, Response } from "express";
import * as SubscriptionService from "./subscription.service";

export async function createSubscription(req: any, res: Response) {
    try {
        const subscription = await SubscriptionService.createSubscriptionService(
            req.user.userId,
            req.body.subjectId,
            req.body.type
        );
        console.log(subscription)
        res.status(201).json(subscription);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
}

export async function getMySubscriptions(req: any, res: Response) {
    const subscriptions =
        await SubscriptionService.getUserSubscriptionsService(req.user.userId);
    res.json(subscriptions);
}

export async function useAttempt(req: any, res: Response) {
    try {
        const subscription = await SubscriptionService.incrementAttemptService(
            req.user.userId,
            req.body.subjectId
        );
        res.json(subscription);
    } catch (err: any) {
        res.status(403).json({ message: err.message });
    }
}
