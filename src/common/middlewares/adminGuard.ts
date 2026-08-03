import { Request, Response, NextFunction } from "express";

// Runs after authGuard, which already decoded the JWT (containing { userId,
// role }) onto req.user. Only gates access — never trust a client-sent role,
// only the one baked into the signed token.
export function requireAdmin(req: any, res: Response, next: NextFunction) {
    if (req.user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
    }
    next();
}
