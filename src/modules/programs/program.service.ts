import { ProgramModel } from "./program.model";
import { Types } from "mongoose";

export async function createProgram(data: {
    name: string;
    code: string;
}) {
    return ProgramModel.create(data);
}

export async function getAllProgramsService() {
    return ProgramModel.find().sort({ createdAt: -1 }).select("-mcqsIds");
}
