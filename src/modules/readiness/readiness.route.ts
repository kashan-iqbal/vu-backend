import { Router } from "express";
import { getReadiness } from "./readiness.controller";
import { authGuard } from "../../common/middlewares/auth.middleware";

export const readinessRouter = Router();

// Read-only, per logged-in user. Params validated in the controller (mirrors
// pastQuiz's GET route, which also validates params rather than the body).
readinessRouter.get("/:code/:examType", authGuard, getReadiness);
