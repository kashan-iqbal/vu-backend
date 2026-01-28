import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

export function authGuard(req: any, res: Response, next: NextFunction) {
    const token = req.cookies.token
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!);
        req.user = decoded;
        next();
    } catch {
        res.status(401).json({ message: "Invalid token" });
    }
}
