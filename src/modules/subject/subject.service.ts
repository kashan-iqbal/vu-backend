import { SubjectModel } from "./subject.model";
import { Types } from "mongoose";

export async function createSubjectService(data: {
    name: string;
    subjectCode: string;
    description?: string;
    programId: Types.ObjectId;
}) {
    return  Array.isArray(data) ? SubjectModel.insertMany(data) : SubjectModel.create(data);
}

export async function getAllSubjectsService() {
    return SubjectModel.find().sort({ createdAt: -1 }).select("-mcqsIds");
}

export async function getSubjectByIdService(id: string) {
    return SubjectModel.find({ programId :id}).select("-mcqsIds");
}

export async function updateSubjectService(
    id: string,
    data: Partial<{ name: string; description: string }>
) {
    return SubjectModel.findByIdAndUpdate(id, data, { new: true });
}

export async function deleteSubjectService(id: string) {
    return SubjectModel.findByIdAndDelete(id);
}

export async function attachMcqsToSubject(
    subjectId: string,
    mcqsId: Types.ObjectId
) {
    return SubjectModel.findByIdAndUpdate(
        subjectId,
        { $addToSet: { mcqsIds: mcqsId } },
        { new: true }
    );
}
