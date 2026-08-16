import { Router } from "express";
import { authGuard } from "../../common/middlewares/auth.middleware";
import { validate } from "../../common/middlewares/validate";
import { createCrashPlanSchema } from "./crashPlan.schema";
import { createCrashPlan, getCrashPlan } from "./crashPlan.controller";

export const crashPlanRouter = Router();

// Per logged-in user. Params validated in the controller (mirrors readiness/pastQuiz).
crashPlanRouter.get("/:code/:examType", authGuard, getCrashPlan);
crashPlanRouter.post(
  "/:code/:examType",
  authGuard,
  validate(createCrashPlanSchema),
  createCrashPlan,
);
