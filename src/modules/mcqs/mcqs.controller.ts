import { Request, Response } from "express";
import * as McqsService from "./mcqs.service";

export async function createMcqs(req: Request, res: Response) {
    try {
        const mcq = await McqsService.createMcqsService(req.body);
        res.status(201).json(mcq);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
}

export async function getMcqsBySubject(req: Request, res: Response) {
    const param = req.params as { subjectId: string, type: string }
    const mcqs = await McqsService.getMcqsBySubjectService(param);
    res.json(mcqs);
}

export async function getMcqsById(req: Request, res: Response) {
    const mcq = await McqsService.getMcqsByIdService(req.params.id);
    if (!mcq) return res.status(404).json({ message: "MCQ not found" });
    res.json(mcq);
}




export async function getFreeMcqsTest(req: Request, res: Response) {
    const mcq = await McqsService.getMcqsByIdService(req.params.id);
    if (!mcq) return res.status(404).json({ message: "MCQ not found" });
    res.json(mcq);
}
export async function deleteMcqs(req: Request, res: Response) {
    await McqsService.deleteMcqsService(req.params.id);
    res.json({ message: "MCQ deleted" });
}






export async function getMcqsTest(req: any, res: Response) {
    const data = await McqsService.getSingleSubjectEligibleMcqs(
        req.params.id,
        req.user.userId,
        req.params.type
    );

    res.json(data);
}