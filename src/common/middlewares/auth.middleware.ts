import jwt from "jsonwebtoken";
import { Response, NextFunction } from "express";
import { UserModel } from "../../modules/user/user.model";

/**
 * Pull a Bearer token out of the Authorization header, if there is one.
 *
 * This is the mobile clients' only way in. React Native has no browser cookie
 * jar it can rely on, and the session cookie is httpOnly so JS cannot read or
 * persist it; the app stores the JWT itself and presents it here instead.
 */
function bearerToken(req: any): string | null {
    const header = req.headers?.authorization;
    if (typeof header !== "string") return null;

    const [scheme, ...rest] = header.trim().split(/\s+/);
    if (scheme?.toLowerCase() !== "bearer") return null;

    const value = rest.join(" ").trim();
    return value.length > 0 ? value : null;
}

/**
 * Annotate the request with the caller's user id, cheaply, for RATE LIMITING ONLY.
 *
 * Mounted app-wide in app.ts before globalLimiter. It is NOT a gate: it performs
 * no database lookup, never rejects anything, and ignores every failure. The real
 * check is still authGuard, per route.
 *
 * ── Why this exists ──
 *
 * globalLimiter is keyed per user, but it is mounted before `app.use("/api/v1",
 * routes)` — and authGuard only runs once a request is INSIDE a route. So
 * `req.user` is still undefined when the limiter builds its key, and keying on it
 * (the way gdbLimiter does, which runs after authGuard on its own route) would
 * silently fall back to IP on every request and fix nothing.
 *
 * The IP fallback is the problem being solved: most Pakistani students reach the
 * API over carrier mobile data behind CGNAT, so thousands of them share a handful
 * of egress IPs and were therefore sharing ONE 150-request budget. A quiz spends
 * about 20 requests (fetch + 15 per-answer grades + submit + readiness + crash
 * plan), so roughly seven students quizzing at once on the same carrier exhausted
 * it and the eighth got a 429 having done nothing wrong. Keying on the user id
 * gives each student their own bucket.
 *
 * Cost: one HMAC verify per request, microseconds, and far less than the indexed
 * Mongo lookup authGuard already does. The token is verified rather than merely
 * decoded so a forged one cannot mint itself a private rate-limit bucket.
 */
export function identifyUser(req: any, _res: Response, next: NextFunction) {
    const token = req.cookies?.token ?? bearerToken(req);
    if (!token) return next();

    try {
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        const userId = decoded?.userId;
        if (typeof userId === "string" && userId.length > 0) {
            req.authUserId = userId;
        }
    } catch {
        // Expired or invalid — fall through to the IP-keyed bucket. authGuard
        // will reject it properly if the route needs auth.
    }

    next();
}

// Verify the JWT, then confirm the account is still usable.
//
// The token alone is not enough: it lives for 7 days with no refresh and no
// revocation list, so a user deactivated by an admin kept full access until their
// cookie expired — `isActive` was stored and shown in the admin UI but never
// enforced on a request. That costs one indexed lookup per authenticated request,
// which is the price of being able to lock an account out at all.
//
// TWO transports, same token. The cookie is checked first so nothing about the
// web app changes; the Authorization header is the fallback for the mobile app.
// Nothing downstream can tell them apart.
//
// Keeping the mobile client on a header rather than a cookie is also what keeps
// csrfGuard satisfied: it waves through any request that carries no session
// cookie, since there is no ambient credential to forge. A cookie-bearing write
// from React Native would be rejected instead, because RN sends no Origin header
// for it to match against FRONTEND_URL.
export async function authGuard(req: any, res: Response, next: NextFunction) {
    const token = req.cookies?.token ?? bearerToken(req);

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
