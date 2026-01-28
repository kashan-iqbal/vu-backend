import { Router } from "express";
import {
    submitMcqs,
    calculateResult,
    getMyResults,
} from "./result.controller";
import { authGuard } from "../../common/middlewares/auth.middleware";

export const resultRouter = Router();

/** protected */
resultRouter.post("/submit", authGuard, submitMcqs);
resultRouter.post(
    "/calculate/:submitResultId",
    authGuard,
    calculateResult
);
resultRouter.get("/me", authGuard, getMyResults);
