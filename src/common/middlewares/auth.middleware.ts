import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

export function authGuard(req: any, res: Response, next: NextFunction) {

    const authCookie = req.cookies?.token;


    if (!authCookie) return res.status(401).json({ message: "Unauthorized" });



    const token = authCookie



    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!);

        req.user = decoded;


        next();
    } catch {
        res.status(401).json({ message: "Invalid token" });
    }
}
