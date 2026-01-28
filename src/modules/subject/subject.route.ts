import { Router } from "express";
import {
    createSubject,
    getAllSubjects,
    getSubjectByProgramId,
    updateSubject,
    deleteSubject,
} from "./subject.controller";
import { authGuard } from "../../common/middlewares/auth.middleware";

export const subjectRouter = Router();

/** public */
subjectRouter.get("/", getAllSubjects);
subjectRouter.get("/:id", getSubjectByProgramId);

/** protected (admin later) */
subjectRouter.post("/", createSubject);
subjectRouter.put("/:id", authGuard, updateSubject);
subjectRouter.delete("/:id", authGuard, deleteSubject);
