import { Router } from "express";
import {
    createMcqs,
    getMcqsBySubject,
    getMcqsById,
    deleteMcqs,
    getMcqsTest,
    getFreeMcqsTest,
} from "./mcqs.controller";
import { authGuard } from "../../common/middlewares/auth.middleware";

export const mcqsRouter = Router();

/** public */
mcqsRouter.get("/subject/:subjectId/:type", getMcqsBySubject);
mcqsRouter.get("/:id", getMcqsById);

/** protected (admin later) */
mcqsRouter.post("/", createMcqs);
mcqsRouter.delete("/:id", authGuard, deleteMcqs);



mcqsRouter.get("/eligible-mcqs/:id/:type", authGuard, getMcqsTest);

mcqsRouter.get("/free-mcqs/:id/:type", authGuard, getMcqsBySubject);

