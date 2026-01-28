import { Router } from "express";
import {
    getAllPrograms,
    createProgramContoller
} from "./programs.controller";

export const programRouter = Router();

/** public */
programRouter.get("/", getAllPrograms);

programRouter.post("/create", createProgramContoller);

