import { Router } from "express";
import {
    createSubscription,
    getMySubscriptions,
    useAttempt,
} from "./subscription.controller";
import { authGuard } from "../../common/middlewares/auth.middleware";

export const subscriptionRouter = Router();

/** protected */
subscriptionRouter.post("/", authGuard, createSubscription);
subscriptionRouter.get("/me", authGuard, getMySubscriptions);
subscriptionRouter.post("/attempt", authGuard, useAttempt);
