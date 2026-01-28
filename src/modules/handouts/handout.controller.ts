import { Request, Response } from "express";
import { createHandout, getHadnout } from "./handout.service";




export async function createHandoutsController (req:Request,res:Response){
    
const { content , id } =  req.body
 const result = await   createHandout(id, content)

    return res.status(201).json(result);

}





export async function getSingleHandout(req: Request, res: Response) {

    const {id } = req.params
    const result = await getHadnout(id)



     res.json(result);

}