import { Request, Response } from "express";
import * as ResultService from "./result.service";

export async function submitMcqs(req: any, res: Response) {
    try {
        const submitResult = await ResultService.submitResultService(
            req.user.userId,
            req.body.mcqs
        );

        res.status(201).json(submitResult);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
}

export async function calculateResult(req: Request, res: Response) {
    try {
        const result = await ResultService.calculateResultService(
            req.params.submitResultId as any
        );
        res.status(201).json(result);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
}

export async function getMyResults(req: any, res: Response) {
    const results = await ResultService.getUserResultsService(req.user.userId);
    res.json(results);
}
