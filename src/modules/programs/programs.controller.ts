import { Request, Response } from "express";
import * as SubjectService from "./program.service";



export async function getAllPrograms(req: Request, res: Response) {
    const subjects = await SubjectService.getAllProgramsService();
    res.json(subjects);
}


export async function createProgramContoller(req: Request, res: Response) {
    const data = req.body
    const subjects = await SubjectService.createProgram(data);
    res.json(subjects);
}
