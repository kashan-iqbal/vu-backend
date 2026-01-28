import { Request, Response } from "express";
import * as SubjectService from "./subject.service";

export async function createSubject(req: Request, res: Response) {
    try {
        const subject = await SubjectService.createSubjectService(req.body);
        console.log(subject)
        res.status(201).json(subject);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
}

export async function getAllSubjects(req: Request, res: Response) {
    const subjects = await SubjectService.getAllSubjectsService();
    res.json(subjects);
}

export async function getSubjectByProgramId(req: Request, res: Response) {
    const subject = await SubjectService.getSubjectByIdService(req.params.id);
    if (!subject) return res.status(404).json({ message: "Subject not found" });
    res.json(subject);
}

export async function updateSubject(req: Request, res: Response) {
    const subject = await SubjectService.updateSubjectService(
        req.params.id,
        req.body
    );
    res.json(subject);
}

export async function deleteSubject(req: Request, res: Response) {
    await SubjectService.deleteSubjectService(req.params.id);
    res.json({ message: "Subject deleted" });
}
