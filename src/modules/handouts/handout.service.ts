import { SubjectModel } from "../subject/subject.model";
import { HandoutModel } from "./handout.model";




export async function createHandout(id: string, content: string) {

    const responce = await HandoutModel.create({
        courseId: id,
        content
    })

    return responce



}






export async function getHadnout(id: string) {

    const handout = await HandoutModel.findOne({
        courseId: id,
    }).lean()


    const subject = await SubjectModel.findOne({ _id: id }).select("-mcqsIds ").lean()






    return {
        ...handout,
        name: subject.name,
        description: subject.description,
        subjectCode: subject.subjectCode
    }



}