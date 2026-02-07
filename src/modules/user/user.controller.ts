import { Request, Response } from "express";
import { UserModel } from "./user.model";
import { NewsLetterModel } from "./newletter.model";



export async function getProfile(req: any, res: Response) {

    const user = await UserModel.findOne({ _id: req.user.userId }).select("-isActive -role -updatedAt ")

    res.json({ user });
}




export async function newsLetter(req: any, res: Response) {
    const { email } = req.body
    const result = await NewsLetterModel.findOne({ email })



    if (result) {
        res.json({ message: "Already subscribe" });
    }
    await NewsLetterModel.create({
        email
    })

    res.json({ message: "You will get all our updates" });

}
