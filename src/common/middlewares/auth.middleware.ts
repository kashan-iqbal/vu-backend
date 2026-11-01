import jwt from "jsonwebtoken";
import { Response, NextFunction } from "express";
import { UserModel } from "../../modules/user/user.model";

// Verify the cookie JWT, then confirm the account is still usable.
//
// The token alone is not enough: it lives for 7 days with no refresh and no
// revocation list, so a user deactivated by an admin kept full access until their
// cookie expired — `isActive` was stored and shown in the admin UI but never
// enforced on a request. That costs one indexed lookup per authenticated request,
// which is the price of being able to lock an account out at all.
export async function authGuard(req: any, res: Response, next: NextFunction) {
    const token = req.cookies?.token;

    if (!token) return res.status(401).json({ message: "Unauthorized" });

    let decoded: any;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET!);
    } catch {
        return res.status(401).json({ message: "Invalid token" });
    }

    try {
        const user = await UserModel.findById(decoded?.userId)
            .select({ isActive: 1, role: 1 })
            .lean<{ _id: unknown; isActive?: boolean; role?: string } | null>();

        if (!user) {
            return res.status(401).json({ message: "Invalid token" });
        }

        // Default to active: documents created before the flag existed have no
        // `isActive` field, and those accounts must not be locked out.
        if (user.isActive === false) {
            return res.status(403).json({ message: "Account is deactivated" });
        }

        // Role comes from the database, not the token, so a role change takes
        // effect immediately instead of after the cookie expires.
        req.user = { ...decoded, role: user.role ?? decoded?.role };
        next();
    } catch (err) {
        console.error("authGuard lookup failed:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
}
